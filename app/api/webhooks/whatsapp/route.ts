// Meta WhatsApp Cloud API webhook: inbound replies and delivery statuses.
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { handleInboundMessage } from "@/lib/pipeline";
import { handleWhatsappStatus } from "@/lib/workflows";

export const dynamic = "force-dynamic";

// Subscription verification handshake.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

type WebhookBody = {
  entry?: {
    changes?: {
      value?: {
        messages?: { from: string; type: string; text?: { body: string }; button?: { text: string } }[];
        statuses?: { id: string; status: string; errors?: { title?: string; message?: string }[] }[];
      };
    }[];
  }[];
};

export async function POST(req: Request) {
  const raw = await req.text();
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex");
    const given = req.headers.get("x-hub-signature-256") ?? "";
    if (given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
      return new Response("bad signature", { status: 401 });
    }
  }
  const body = JSON.parse(raw || "{}") as WebhookBody;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        const text = m.text?.body ?? m.button?.text ?? `[${m.type}]`;
        handleInboundMessage("+" + m.from, text);
      }
      for (const s of change.value?.statuses ?? []) {
        await handleWhatsappStatus(s.id, s.status, s.errors?.[0]?.message ?? s.errors?.[0]?.title);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
