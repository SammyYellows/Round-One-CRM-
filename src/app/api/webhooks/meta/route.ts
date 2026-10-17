// Meta's webhook for Facebook Page and Instagram messages (Sammy,
// 14/10/2026): messages people send us, replies staff send from the
// Facebook or Instagram app (echoes), and delivered and read receipts for
// what we sent. Public, so every POST must carry Meta's signature, made with
// our app secret. WhatsApp has its own webhook (../whatsapp).

import crypto from "node:crypto";
import { applyAction } from "@/lib/server/state";
import { afterResponse } from "@/lib/server/background";
import { readContactReplies } from "@/lib/server/insights";
import { socialProfile } from "@/lib/server/social";
import { STORY_MENTION } from "@/lib/messageInbox";
import { saveSocialMedia, type SocialMediaRef } from "@/lib/server/media";
import { db } from "@/lib/server/supabase";
import { SocialChannel } from "@/lib/types";

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

type Incoming = {
  mid?: string;
  text?: string;
  is_echo?: boolean;
  is_deleted?: boolean;
  app_id?: number | string;
  attachments?: { type?: string; payload?: { url?: string } }[];
};
type Messaging = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: Incoming;
  postback?: { mid?: string; title?: string };
  delivery?: { watermark?: number };
  read?: { watermark?: number };
};
type Body = { object?: string; entry?: { id?: string; messaging?: Messaging[] }[] };

const ATTACHMENT: Record<string, string> = {
  image: "Photo", video: "Video", audio: "Voice note", file: "File", share: "Shared a post", story_mention: "Mentioned us in their story",
  ig_reel: "Shared a reel", reel: "Shared a reel", sticker: "Sticker", like_heart: "❤️",
};

/** Photos, videos, voice notes and stickers to copy into the CRM (media.ts); shared posts and reels stay as labels. */
function mediaOf(m: Incoming): SocialMediaRef[] {
  const kinds: Record<string, SocialMediaRef["kind"]> = { image: "image", video: "video", audio: "audio", file: "document", sticker: "sticker" };
  return (m.attachments ?? []).flatMap((a) => (a.payload?.url && kinds[a.type ?? ""] ? [{ url: a.payload.url, kind: kinds[a.type ?? ""] }] : []));
}

function textOf(m: Incoming) {
  if (m.text?.trim()) return m.text.slice(0, 4000);
  const kinds = (m.attachments ?? []).map((a) => ATTACHMENT[a.type ?? ""] ?? a.type ?? "Attachment");
  return kinds.length ? kinds.map((k) => `[${k}]`).join(" ") : "[Message]";
}

function signed(raw: string, header: string | null, secret: string) {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const given = header ?? "";
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

const KEY: Record<SocialChannel, string> = { facebook: "facebookId", instagram: "instagramId" };

async function contactIdFor(channel: SocialChannel, userId: string) {
  const { data } = await db().from("contacts").select("id").eq(`social->>${KEY[channel]}`, userId).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Delivered or read: moves our earlier messages to them on, never back. */
async function markUpTo(channel: SocialChannel, userId: string, status: "delivered" | "read", at: number) {
  const contactId = await contactIdFor(channel, userId);
  if (!contactId) return;
  await db().from("messages").update({ status })
    .eq("contact_id", contactId).eq("channel", channel).eq("dir", "out")
    .in("status", status === "read" ? ["sent", "delivered"] : ["sent"])
    .lte("at", new Date(at).toISOString());
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
  const channel: SocialChannel | null = body.object === "page" ? "facebook" : body.object === "instagram" ? "instagram" : null;
  if (!channel) return Response.json({ ok: true });
  const prefix = channel === "facebook" ? "fb" : "ig";

  try {
    for (const entry of body.entry ?? []) {
      for (const ev of entry.messaging ?? []) {
        const at = ev.timestamp ?? Date.now();
        if (ev.message?.is_deleted) continue;
        if (ev.message?.is_echo) {
          // Something the Page sent. Ours are already in the thread; anything else is staff replying from the app.
          const userId = ev.recipient?.id;
          const mid = ev.message.mid;
          if (!userId || !mid || String(ev.message.app_id ?? "") === process.env.META_APP_ID) continue;
          const { data: known } = await db().from("messages").select("id").eq("provider_id", mid).limit(1).maybeSingle();
          if (!known) await applyAction("recordSocialEcho", [{ id: `${prefix}_${mid}`, channel, userId, text: textOf(ev.message) }]);
        } else if (ev.message || ev.postback) {
          const userId = ev.sender?.id;
          if (!userId || userId === entry.id) continue;
          const mid = ev.message?.mid ?? ev.postback?.mid ?? `${userId}_${at}`;
          const text = ev.message ? textOf(ev.message) : `[Pressed “${ev.postback?.title ?? "a button"}”]`;
          // A story mention isn't a message to answer (Sammy, 17/10/2026): not kept, so it never reaches Enquiries.
          if (text === STORY_MENTION) continue;
          // Their name only matters the first time they message.
          const who = (await contactIdFor(channel, userId)) ? {} : await socialProfile(channel, userId);
          const after = await applyAction("receiveSocial", [{ id: `${prefix}_${mid}`, channel, userId, ...who, text }]);
          // Claude reads what they've said and leaves a note + suggested reply for staff (never sent by itself).
          const media = ev.message ? mediaOf(ev.message) : [];
          if (media.length) await afterResponse(saveSocialMedia(`${prefix}_${mid}`, media));
          const contactId = after.messages.find((x) => x.id === `${prefix}_${mid}`)?.contactId;
          if (contactId) await afterResponse(readContactReplies(contactId).catch((e) => console.error("[insight]", e instanceof Error ? e.message : e)));
        } else if (ev.delivery && ev.sender?.id) {
          await markUpTo(channel, ev.sender.id, "delivered", ev.delivery.watermark ?? at);
        } else if (ev.read && ev.sender?.id) {
          await markUpTo(channel, ev.sender.id, "read", ev.read.watermark ?? at);
        }
      }
    }
  } catch (e) {
    // Meta retries failed deliveries, and receiveSocial ignores repeats.
    console.error("[meta webhook]", e);
    return new Response("Error", { status: 500 });
  }
  return Response.json({ ok: true });
}
