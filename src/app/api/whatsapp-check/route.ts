// Reads the state of the WhatsApp accounts from Meta (11/10/2026), for fixing
// the gym number's set-up: account and payment details, Meta's own "can it
// send" health check, the phone numbers, connected apps and templates. Read
// only: nothing is changed or sent. Uses the CRM's WhatsApp key, so the key
// itself never leaves Vercel. Needs CRON_SECRET, like /api/cron.

export const dynamic = "force-dynamic";

const API = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v21.0"}`;
const GYM_WABA = "1438210021679060"; // "Round One Gym", the real number 07833 399014

async function graph(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return res.ok ? json : { error: (json.error as { message?: string })?.message ?? `HTTP ${res.status}` };
}

/** Each field on its own, so one Meta doesn't recognise doesn't hide the rest. */
async function fields(id: string, names: string[]) {
  const out: Record<string, unknown> = {};
  await Promise.all(names.map(async (f) => { const r = await graph(id, { fields: f }); out[f] = "error" in r ? `(${r.error})` : r[f]; }));
  return out;
}

async function account(waba: string) {
  const [info, phones, apps, templates] = await Promise.all([
    fields(waba, ["name", "currency", "timezone_id", "account_review_status", "business_verification_status", "primary_funding_id", "owner_business_info", "on_behalf_of_business_info", "health_status"]),
    graph(`${waba}/phone_numbers`, { fields: "id,display_phone_number,verified_name,status,platform_type,quality_rating,code_verification_status,name_status,messaging_limit_tier,is_on_biz_app,health_status" }),
    graph(`${waba}/subscribed_apps`),
    graph(`${waba}/message_templates`, { fields: "name,status,category,language", limit: "200" }),
  ]);
  const t = (templates as { data?: { name: string; status: string; category: string }[] }).data;
  return { waba, ...info, phones, apps, templates: t ? t.map((x) => `${x.name} (${x.status.toLowerCase()}, ${x.category.toLowerCase()})`) : templates };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Not allowed" }, { status: 401 });
  if (!process.env.WHATSAPP_TOKEN) return Response.json({ error: "No WHATSAPP_TOKEN" }, { status: 500 });
  // ?waba=<id> also reads that account (e.g. a new one Meta made for the gym number).
  const extra = new URL(req.url).searchParams.get("waba");
  const ids = [...new Set([process.env.WHATSAPP_BUSINESS_ACCOUNT_ID, GYM_WABA, ...(extra && /^\d+$/.test(extra) ? [extra] : [])].filter(Boolean) as string[])];
  const token = await graph("debug_token", { input_token: process.env.WHATSAPP_TOKEN });
  const d = (token as { data?: { is_valid?: boolean; scopes?: string[]; granular_scopes?: { scope: string; target_ids?: string[] }[]; expires_at?: number } }).data;
  return Response.json({
    token: d ? { valid: d.is_valid, scopes: d.scopes, targets: d.granular_scopes, expires: d.expires_at } : token,
    crmUses: { waba: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID, phone: process.env.WHATSAPP_PHONE_NUMBER_ID },
    accounts: await Promise.all(ids.map(account)),
  });
}
