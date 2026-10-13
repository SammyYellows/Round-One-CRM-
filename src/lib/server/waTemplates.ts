// Puts the CRM's WhatsApp templates on a WhatsApp account for Meta to approve
// (the same as scripts/whatsapp-templates.mjs, but run on the server, where
// the WhatsApp key lives). Used when the gym number lands in a new account
// (Sammy, 13/10/2026). Submits only; nothing is ever sent to anyone.

import { db } from "./supabase";

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v21.0"}`;

// Example values Meta's reviewers see for each placeholder.
const SAMPLES: Record<string, string> = {
  first: "Sam", name: "Sam Taylor", date: "Tuesday 30 September", time: "6:00 pm",
  trial: "Tuesday 30 September, 6:00 pm", trialTime: "6:00 pm",
  address: "Unit 2 Kings Business Park, Kings Park Ave, Bristol BS2 0TZ",
  gym: "Round One", team: "The Round One team", report: "Weekly members report", headline: "312 members, +4 in the last 30 days.",
};

async function graph(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GRAPH}/${path}`, { ...init, headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, ...(init.headers ?? {}) } });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { error_user_msg?: string; message?: string } };
  if (!res.ok) throw new Error(json.error?.error_user_msg || json.error?.message || `Meta said ${res.status}`);
  return json;
}

async function upload(name: string, type: string, bytes: Buffer) {
  const appId = process.env.META_APP_ID;
  if (!appId) throw new Error("META_APP_ID isn’t set");
  const session = (await graph(`${appId}/uploads?file_name=${encodeURIComponent(name)}&file_length=${bytes.length}&file_type=${type}`, { method: "POST" })) as { id: string };
  const res = await fetch(`${GRAPH}/${session.id}`, { method: "POST", headers: { Authorization: `OAuth ${process.env.WHATSAPP_TOKEN}`, file_offset: "0" }, body: new Uint8Array(bytes) });
  const json = (await res.json()) as { h?: string };
  if (!json.h) throw new Error(`Upload failed: ${JSON.stringify(json)}`);
  return json.h;
}

const SAMPLE_PDF = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n160\n%%EOF";

type Row = { name: string; body: string; category: string; language?: string; header_video?: string; header_document?: boolean; button_text?: string; button_url?: string };

/** Submits each template the account doesn't have yet (or only `only`). Returns one line per template. */
export async function submitTemplates(waba: string, opts: { only?: string[]; statusOnly?: boolean } = {}) {
  const { data, error } = await db().from("templates").select("*").order("name");
  if (error) throw new Error(error.message);
  const rows = (data as Row[]).filter((t) => !opts.only?.length || opts.only.includes(t.name));
  const existing = new Map<string, { status: string; rejected_reason?: string }>();
  let next: string | null = `${waba}/message_templates?fields=name,status,language,rejected_reason&limit=100`;
  while (next) {
    const page = (await graph(next)) as { data?: { name: string; status: string; language: string; rejected_reason?: string }[]; paging?: { next?: string } };
    for (const t of page.data ?? []) if (t.language === "en_GB") existing.set(t.name, t);
    next = page.paging?.next ? page.paging.next.replace(`${GRAPH}/`, "") : null;
  }
  const out: string[] = [];
  for (const t of rows) {
    const have = existing.get(t.name);
    if (have) { out.push(`${t.name}: ${have.status.toLowerCase()}${have.rejected_reason && have.rejected_reason !== "NONE" ? ` (${have.rejected_reason})` : ""}`); continue; }
    if (opts.statusOnly) { out.push(`${t.name}: not submitted`); continue; }
    const keys = [...t.body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    let n = 0;
    const text = t.body.replace(/\{(\w+)\}/g, () => `{{${++n}}}`);
    try {
      const components: unknown[] = [];
      if (t.header_video) {
        const url = /^https?:/.test(t.header_video) ? t.header_video : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/whatsapp-media/${t.header_video}`;
        components.push({ type: "HEADER", format: "VIDEO", example: { header_handle: [await upload(t.header_video, "video/mp4", Buffer.from(await (await fetch(url)).arrayBuffer()))] } });
      } else if (t.header_document) {
        components.push({ type: "HEADER", format: "DOCUMENT", example: { header_handle: [await upload("sample-report.pdf", "application/pdf", Buffer.from(SAMPLE_PDF, "latin1"))] } });
      }
      components.push({ type: "BODY", text, ...(keys.length ? { example: { body_text: [keys.map((k) => SAMPLES[k] ?? k)] } } : {}) });
      if (t.button_text && t.button_url) {
        const app = (process.env.APP_URL || "").replace(/\/$/, "");
        const url = /^https?:/.test(t.button_url) ? t.button_url : app + t.button_url;
        components.push({ type: "BUTTONS", buttons: [{ type: "URL", text: t.button_text, url, ...(url.includes("{{1}}") ? { example: [url.replace("{{1}}", "k3x9q2m7a1b4c8d0e5f6g2h1")] } : {}) }] });
      }
      const res = (await graph(`${waba}/message_templates`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: t.name, language: t.language || "en_GB", category: t.category.toUpperCase(), components }),
      })) as { status?: string };
      out.push(`${t.name}: submitted (${String(res.status).toLowerCase()})`);
    } catch (e) {
      out.push(`${t.name}: not submitted. ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}
