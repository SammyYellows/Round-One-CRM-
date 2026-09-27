// Sends the WhatsApp templates in the database to Meta for approval, with
// their header videos and "Book meeting" buttons, and records what Meta says.
//
//   npm run wa:templates            submit any template Meta doesn't have yet
//   npm run wa:templates -- --status   just fetch approval statuses
//
// Needs WHATSAPP_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID, META_APP_ID (for video
// uploads), APP_URL (the booking link in buttons), NEXT_PUBLIC_SUPABASE_URL
// and SUPABASE_SECRET_KEY. Meta only lets each name be created once per
// language: to change an approved template, edit it in WhatsApp Manager or
// give it a new name.

const env = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Set ${k} first.`);
    process.exit(1);
  }
  return v;
};

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v21.0"}`;
const token = env("WHATSAPP_TOKEN");
const waba = env("WHATSAPP_BUSINESS_ACCOUNT_ID");
const supabase = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const secret = env("SUPABASE_SECRET_KEY");
const statusOnly = process.argv.includes("--status");

// Example values Meta's reviewers see for each placeholder.
const SAMPLES = {
  first: "Sam",
  name: "Sam Taylor",
  date: "Tuesday 30 September",
  time: "6:00 pm",
  trial: "Tuesday 30 September, 6:00 pm",
  trialTime: "6:00 pm",
  address: "Unit 2 Kings Business Park, Kings Park Ave, Bristol BS2 0TZ",
  gym: "Round One",
  team: "The Round One team",
};

async function graph(path, init = {}) {
  const res = await fetch(`${GRAPH}/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.error_user_msg || json.error?.message || `Meta said ${res.status}`);
  return json;
}

async function rest(path, init = {}) {
  const res = await fetch(`${supabase}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Supabase said ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const setStatus = (name, meta_status) =>
  rest(`templates?name=eq.${encodeURIComponent(name)}`, { method: "PATCH", body: JSON.stringify({ meta_status, updated_at: new Date().toISOString() }), headers: { Prefer: "return=minimal" } });

/** Uploads a video to Meta and returns the handle a template header example needs. */
async function uploadVideo(file) {
  const url = /^https?:/.test(file) ? file : `${supabase}/storage/v1/object/public/whatsapp-media/${file}`;
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  const appId = env("META_APP_ID");
  const session = await graph(`${appId}/uploads?file_name=${encodeURIComponent(file)}&file_length=${bytes.length}&file_type=video/mp4`, { method: "POST" });
  const res = await fetch(`${GRAPH}/${session.id}`, { method: "POST", headers: { Authorization: `OAuth ${token}`, file_offset: "0" }, body: bytes });
  const json = await res.json();
  if (!json.h) throw new Error(`Video upload failed: ${JSON.stringify(json)}`);
  return json.h;
}

const STATUS = { APPROVED: "approved", REJECTED: "rejected", PENDING: "submitted", IN_APPEAL: "submitted", PAUSED: "approved", DISABLED: "rejected" };

const templates = await rest("templates?select=*&order=name");
const existing = new Map();
let next = `${waba}/message_templates?fields=name,status,language,category,rejected_reason&limit=100`;
while (next) {
  const page = await graph(next);
  for (const t of page.data ?? []) if (t.language === "en_GB") existing.set(t.name, t);
  next = page.paging?.next ? page.paging.next.replace(`${GRAPH}/`, "") : null;
}

for (const t of templates) {
  const have = existing.get(t.name);
  if (have) {
    await setStatus(t.name, STATUS[have.status] ?? "submitted");
    console.log(`${t.name}: ${have.status.toLowerCase()}${have.rejected_reason && have.rejected_reason !== "NONE" ? ` (${have.rejected_reason})` : ""}`);
    continue;
  }
  if (statusOnly) {
    console.log(`${t.name}: not submitted`);
    continue;
  }

  const keys = [...t.body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  let n = 0;
  const text = t.body.replace(/\{(\w+)\}/g, () => `{{${++n}}}`);
  const components = [];
  if (t.header_video) components.push({ type: "HEADER", format: "VIDEO", example: { header_handle: [await uploadVideo(t.header_video)] } });
  components.push({ type: "BODY", text, ...(keys.length ? { example: { body_text: [keys.map((k) => SAMPLES[k] ?? k)] } } : {}) });
  if (t.button_text && t.button_url) {
    const app = env("APP_URL").replace(/\/$/, "");
    const url = /^https?:/.test(t.button_url) ? t.button_url : app + t.button_url;
    components.push({
      type: "BUTTONS",
      buttons: [{ type: "URL", text: t.button_text, url, ...(url.includes("{{1}}") ? { example: [url.replace("{{1}}", "k3x9q2m7a1b4c8d0e5f6g2h1")] } : {}) }],
    });
  }

  try {
    const res = await graph(`${waba}/message_templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: t.name, language: t.language || "en_GB", category: t.category.toUpperCase(), components }),
    });
    await setStatus(t.name, STATUS[res.status] ?? "submitted");
    console.log(`${t.name}: submitted (${String(res.status).toLowerCase()})`);
  } catch (e) {
    console.error(`${t.name}: not submitted. ${e.message}`);
  }
}
