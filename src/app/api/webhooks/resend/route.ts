// Resend's webhook: an email arrived for the receiving address (a copy of
// everything sent to info@), or a delivery update for an email we sent. Signed the Svix way with RESEND_WEBHOOK_SECRET.
// Answer at once; fetching and reading the email happens in the background.

import crypto from "node:crypto";
import { afterResponse } from "@/lib/server/background";
import { ingestReceived } from "@/lib/server/enquiries";
import { recordDeliveryEvent } from "@/lib/server/mailouts";

export const dynamic = "force-dynamic";

function signed(raw: string, headers: Headers, secret: string) {
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigs = headers.get("svix-signature");
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // older than 5 minutes
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest("base64");
  return sigs.split(" ").some((part) => {
    const [, sig] = part.split(",");
    return !!sig && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  });
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("Receiving isn’t set up", { status: 500 });
  const raw = await req.text();
  if (!signed(raw, req.headers, secret)) return new Response("Bad signature", { status: 401 });
  const body = JSON.parse(raw) as { type?: string; data?: { email_id?: string } };
  if (body.type === "email.received" && body.data?.email_id) {
    await afterResponse(ingestReceived(body.data.email_id));
  } else if (body.type?.startsWith("email.") && body.data?.email_id) {
    // Delivered, opened, bounced… for mailouts (other emails are ignored).
    await afterResponse(recordDeliveryEvent(body.type, body.data.email_id));
  }
  return Response.json({ ok: true });
}
