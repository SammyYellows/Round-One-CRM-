// One-off WhatsApp number moves (Sammy, 12/10/2026: move the gym number,
// API-only, into the GBP account). Switches a number off or on for the
// Cloud API with the CRM's own key, so the key never leaves Vercel. Needs
// CRON_SECRET. Actions, in the order a move uses them:
//   {action:"add", waba, number, name, migrate?}: puts a number into an
//     account (number like 447833399014, name = the display name); returns
//     its id. migrate:true moves it from another of our accounts instead,
//     keeping it working there until the code is verified.
//   {action:"request_code", phoneId, method: "SMS"|"VOICE"}: Meta texts or
//     rings the six-digit code to that phone.
//   {action:"verify_code", phoneId, code}: the code read off the phone.
//   {action:"register", phoneId, pin}: switches it on for the Cloud API
//     (pin: the six-digit two-step PIN). {action:"deregister", phoneId}.
//   {action:"phones", waba}: the account's numbers (read only).
//   {action:"subscribe", waba}: sends that account's WhatsApp webhooks to
//     the CRM (this app). {action:"templates", waba, only?, statusOnly?}:
//     submits the CRM's templates there for approval (never sends one).

import { submitTemplates } from "@/lib/server/waTemplates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v21.0"}`;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Not allowed" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; phoneId?: string; pin?: string; waba?: string; number?: string; name?: string; method?: string; code?: string; migrate?: boolean; only?: string[]; statusOnly?: boolean };
  const wabaOk = /^\d+$/.test(String(b.waba ?? ""));
  if (b.action === "phones" || b.action === "subscribe") {
    if (!wabaOk) return Response.json({ error: "Needs waba" }, { status: 400 });
    const res = await fetch(`${API}/${b.waba}/${b.action === "phones" ? "phone_numbers?fields=id,display_phone_number,verified_name,status,code_verification_status,name_status,platform_type,quality_rating" : "subscribed_apps"}`, {
      method: b.action === "phones" ? "GET" : "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    });
    return Response.json({ status: res.status, meta: await res.json().catch(() => ({})) });
  }
  if (b.action === "templates") {
    if (!wabaOk) return Response.json({ error: "Needs waba" }, { status: 400 });
    try {
      return Response.json({ ok: true, result: await submitTemplates(String(b.waba), { only: b.only, statusOnly: b.statusOnly === true }) });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }
  if (b.action === "add") {
    const waba = String(b.waba ?? ""), number = String(b.number ?? "").replace(/\D/g, ""), name = String(b.name ?? "").trim();
    if (!/^\d+$/.test(waba) || !/^44\d{10}$/.test(number) || !name) return Response.json({ error: "Needs waba, a UK number like 447833399014, and the display name" }, { status: 400 });
    const res = await fetch(`${API}/${waba}/phone_numbers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ cc: "44", phone_number: number.slice(2), verified_name: name, ...(b.migrate === true ? { migrate_phone_number: true } : {}) }),
    });
    return Response.json({ status: res.status, meta: await res.json().catch(() => ({})) });
  }
  const phoneId = String(b.phoneId ?? "");
  if (!/^\d+$/.test(phoneId)) return Response.json({ error: "phoneId must be the number's id" }, { status: 400 });
  let body: Record<string, string>;
  if (b.action === "deregister") body = {};
  else if (b.action === "register" && /^\d{6}$/.test(String(b.pin ?? ""))) body = { messaging_product: "whatsapp", pin: String(b.pin) };
  else if (b.action === "request_code" && (b.method === "SMS" || b.method === "VOICE")) body = { code_method: b.method, language: "en_GB" };
  else if (b.action === "verify_code" && /^\d{6}$/.test(String(b.code ?? "").replace(/\D/g, ""))) body = { code: String(b.code).replace(/\D/g, "") };
  else return Response.json({ error: "Unknown action, or the PIN or code isn't six digits" }, { status: 400 });
  const res = await fetch(`${API}/${phoneId}/${b.action}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return Response.json({ status: res.status, meta: await res.json().catch(() => ({})) });
}
