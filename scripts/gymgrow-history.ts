// Copies GymGrow's message history into gymgrow_messages (Sammy, 12/10/2026).
// Only people already in the CRM (matched on phone, then email); nobody new
// is added and nothing is sent. Read-only on GymGrow (a Private Integration
// key with conversations read scopes).
//
//   GYMGROW_TOKEN=… npx tsx scripts/gymgrow-history.ts            dry run: counts only
//   GYMGROW_TOKEN=… npx tsx scripts/gymgrow-history.ts --write    save
//
// Needs the Supabase settings from .env.local. Safe to run again: rows are
// keyed on GymGrow's message id.

import { db } from "../src/lib/server/supabase";

const TOKEN = process.env.GYMGROW_TOKEN;
const LOCATION = process.env.GYMGROW_LOCATION || "eRmW9UXThqUOl75q6r0t";
const WRITE = process.argv.includes("--write");
const API = "https://services.leadconnectorhq.com";
const H = { Authorization: `Bearer ${TOKEN}`, Version: "2021-04-15", Accept: "application/json" };

type Json = Record<string, unknown>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(path: string, params: Record<string, string> = {}, attempt = 0): Promise<Json> {
  const u = new URL(API + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, { headers: H });
  if ((res.status === 429 || res.status >= 500) && attempt < 5) { await sleep(2000 * 2 ** attempt); return get(path, params, attempt + 1); }
  const j = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new Error(`GymGrow ${res.status} ${path}: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

const norm = (p: unknown) => {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.startsWith("44")) d = "0" + d.slice(2);
  if (d.length === 10 && d.startsWith("7")) d = "0" + d;
  return d.length >= 10 ? d : "";
};
const text = (html: string) => html
  .replace(/<(br|\/p|\/div|\/li|\/h\d)[^>]*>/gi, "\n").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const CHANNEL: Record<string, "whatsapp" | "sms" | "email" | "call"> = { TYPE_WHATSAPP: "whatsapp", TYPE_SMS: "sms", TYPE_EMAIL: "email", TYPE_CALL: "call" };

async function conversations(): Promise<Json[]> {
  const out: Json[] = [];
  let after: unknown = null;
  for (;;) {
    const p: Record<string, string> = { locationId: LOCATION, limit: "100" };
    if (after) p.startAfterDate = String(after);
    const j = await get("/conversations/search", p);
    const c = (j.conversations as Json[]) ?? [];
    out.push(...c);
    if (c.length < 100) return out;
    const last = c[c.length - 1];
    after = (last.sort as unknown[] | undefined)?.[0] ?? last.lastMessageDate;
  }
}

async function messages(conversationId: string): Promise<Json[]> {
  const out: Json[] = [];
  let lastMessageId = "";
  for (let page = 0; page < 100; page++) {
    const p: Record<string, string> = { limit: "100" };
    if (lastMessageId) p.lastMessageId = lastMessageId;
    const j = (await get(`/conversations/${conversationId}/messages`, p)).messages as Json;
    const m = (j?.messages as Json[]) ?? [];
    out.push(...m);
    if (!j?.nextPage || !m.length) return out;
    lastMessageId = String(j.lastMessageId ?? m[m.length - 1].id);
    await sleep(120);
  }
  return out;
}

async function main() {
  if (!TOKEN) throw new Error("Set GYMGROW_TOKEN");
  const { data: contacts, error } = await db().from("contacts").select("id, phone, email").is("removed", null);
  if (error) throw new Error(error.message);
  const byPhone = new Map<string, string>(), byEmail = new Map<string, string>();
  for (const c of contacts ?? []) {
    const p = norm(c.phone); if (p && !byPhone.has(p)) byPhone.set(p, c.id as string);
    const e = String(c.email ?? "").trim().toLowerCase(); if (e && !byEmail.has(e)) byEmail.set(e, c.id as string);
  }

  const convs = await conversations();
  const counts: Record<string, number> = {};
  const add = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);
  let rows: Json[] = [];
  let people = 0;
  for (const [i, c] of convs.entries()) {
    const contactId = byPhone.get(norm(c.phone)) ?? byEmail.get(String(c.email ?? "").toLowerCase());
    if (!contactId) { add("conversations not matched (left out)"); continue; }
    people++;
    for (const m of await messages(String(c.id))) {
      const channel = CHANNEL[String(m.messageType)];
      if (!channel) { add(`skipped ${m.messageType}`); continue; }
      const meta = (m.meta as Json | undefined) ?? {};
      const email = (meta.email as Json | undefined) ?? {};
      const body = channel === "email" || m.contentType === "text/html" ? text(String(m.body ?? "")) : String(m.body ?? "").trim();
      rows.push({
        id: String(m.id), contact_id: contactId, channel, dir: m.direction === "inbound" ? "in" : "out",
        subject: email.subject ? String(email.subject) : null, body, status: m.status ? String(m.status) : null,
        source: m.source ? String(m.source) : null, at: String(m.dateAdded),
      });
      add(`${channel} ${m.direction === "inbound" ? "in" : "out"}`);
    }
    if (WRITE && rows.length >= 500) { await save(rows); rows = []; }
    if ((i + 1) % 50 === 0) console.log(`…${i + 1} of ${convs.length} conversations`);
  }
  if (WRITE && rows.length) await save(rows);
  console.log(JSON.stringify({ mode: WRITE ? "WRITE" : "dry run (nothing saved)", conversations: convs.length, peopleMatched: people, ...counts }, null, 1));
}

async function save(rows: Json[]) {
  const { error } = await db().from("gymgrow_messages").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Saving: ${error.message}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
