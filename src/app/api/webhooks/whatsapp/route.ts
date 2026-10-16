// Meta's WhatsApp webhook: replies from people, and delivery updates (sent,
// delivered, read, failed) for what we sent. Public, so every POST must carry
// Meta's signature, made with our app secret.

import crypto from "node:crypto";
import { applyAction } from "@/lib/server/state";
import { afterResponse } from "@/lib/server/background";
import { readContactReplies } from "@/lib/server/insights";
import { db } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/** Meta checks the webhook address once, when it's set up. */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type Body = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: Incoming[];
        statuses?: { id: string; status: string; errors?: { title?: string; message?: string; error_data?: { details?: string } }[] }[];
      };
    }[];
  }[];
};

type Media = { caption?: string; filename?: string };
type Incoming = {
  id: string; from: string; type: string; text?: { body: string }; button?: { text: string }; interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
  reaction?: { message_id?: string; emoji?: string }; image?: Media; video?: Media; document?: Media; location?: { name?: string; address?: string };
};

// The words of an incoming message. Ones with no words get a label in square
// brackets (src/lib/messageText.ts shows them nicely); a reaction keeps its
// emoji (Sammy, 16/10/2026). null: nothing to record (a reaction taken back).
function textOf(m: Incoming): string | null {
  const said = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title;
  if (said !== undefined) return said;
  if (m.type === "reaction") return m.reaction?.emoji ? `[Reacted ${m.reaction.emoji}]` : null;
  const label: Record<string, string> = { image: "Photo", video: "Video", audio: "Voice note", sticker: "Sticker", document: "Document", location: "Location", contacts: "Contacts", unsupported: "Unsupported" };
  const media = m.image ?? m.video ?? m.document;
  const extra = media?.caption || media?.filename || (m.location ? [m.location.name, m.location.address].filter(Boolean).join(", ") : "");
  return `[${label[m.type] ?? m.type}]${extra ? ` ${extra}` : ""}`;
}

// A status only ever moves forward: a late "delivered" never undoes "read".
const RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

function signed(raw: string, header: string | null, secret: string) {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const given = header ?? "";
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

async function updateStatus(providerId: string, status: string, error?: string) {
  if (!(status in RANK)) return;
  const { data } = await db().from("messages").select("id, status, contact_id, template").eq("provider_id", providerId).maybeSingle();
  if (!data || (RANK[data.status as string] ?? 0) >= RANK[status]) return;
  await db().from("messages").update({ status, ...(error ? { error } : {}) }).eq("id", data.id);
  if (status === "failed") {
    await db().from("events").insert({
      id: crypto.randomUUID(), type: "whatsapp.failed", contact_id: data.contact_id, data: {},
      detail: `WhatsApp ${data.template ?? "reply"} wasn’t delivered${error ? `: ${error}` : ""}`,
    });
  }
}

export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return new Response("Not configured", { status: 500 });
  const raw = await req.text();
  if (!signed(raw, req.headers.get("x-hub-signature-256"), secret)) return new Response("Bad signature", { status: 401 });

  let body: Body;
  try {
    body = JSON.parse(raw) as Body;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const v = change.value ?? {};
        for (const m of v.messages ?? []) {
          const text = textOf(m);
          if (text === null) continue;
          const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
          const after = await applyAction("receiveWhatsApp", [{ id: `wa_${m.id}`, phone: `+${m.from}`, name, text: text.slice(0, 4000) }]);
          // Claude reads what they've said and leaves a note + suggested reply for staff (never sent by itself).
          const who = after.messages.find((x) => x.id === `wa_${m.id}`)?.contactId;
          if (who) await afterResponse(readContactReplies(who).catch((e) => console.error("[insight]", e instanceof Error ? e.message : e)));
        }
        for (const st of v.statuses ?? []) {
          const err = st.errors?.[0];
          await updateStatus(st.id, st.status, err?.error_data?.details || err?.message || err?.title);
        }
      }
    }
  } catch (e) {
    // Meta retries failed deliveries, and receiveWhatsApp ignores repeats.
    console.error("[whatsapp webhook]", e);
    return new Response("Error", { status: 500 });
  }
  return Response.json({ ok: true });
}
