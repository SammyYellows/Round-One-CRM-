// Safety details from TeamUp (improvement item 20, Sammy 10/10/2026, after a
// medical emergency where the member had no waiver or emergency contact on
// file). Two parts, server-only:
//
//   refreshSafety  the nightly "safety" sync stage: every signed waiver
//                  (/waiver_agreements) and every sign-up form answer
//                  (/customer_form_submissions, fields found by system_use)
//                  onto contact.safety, keyed by TeamUp customer id.
//   whoIsIn        live, on demand: who has been ticked into a class that's
//                  on now (or just finished) and who has come through the
//                  Kisi door in the last few hours, with each person's waiver
//                  and emergency contact. Kisi only logs entries, not exits,
//                  so "in the gym" means "came in within the window".
//
// Checked against the live account 10/10/2026: TeamUp ignores every date and
// ordering filter on these lists but honours `event=` on /attendances, so
// the activity stage saves the next two days' events for this to use.

import { recordSafety } from "@/lib/engine";
import type { Contact, Safety } from "@/lib/types";
import { kisiConfigured } from "./kisi";
import { applyMany } from "./state";
import { ukParts } from "@/lib/time";
import { db } from "./supabase";
import { fetchJson, teamupConfigured } from "./teamup";

type Json = Record<string, unknown>;

// Eight pages at a time: the form-submission pages are heavy (first live
// run at four: 27s, too close to Vercel's 60s). TeamUp allows 250 calls a
// minute and the whole stage is under 30 calls.
const PARALLEL = 8;
async function listAll(path: string, params: Record<string, string> = {}): Promise<Json[]> {
  const first = (await fetchJson(path, { page_size: "100", page: "1", ...params })) as Json;
  const out: Json[] = [...((first.results as Json[]) ?? [])];
  const pages = Math.ceil((Number(first.count ?? out.length) || out.length) / 100);
  for (let from = 2; from <= pages; from += PARALLEL) {
    const batch = await Promise.all(Array.from({ length: Math.min(PARALLEL, pages - from + 1) }, (_, i) => fetchJson(path, { page_size: "100", page: String(from + i), ...params }) as Promise<Json>));
    for (const pg of batch) out.push(...((pg.results as Json[]) ?? []));
  }
  return out;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Reads TeamUp and returns safety details per customer id. */
export async function fetchSafety(): Promise<Map<string, Omit<Safety, "syncedAt">>> {
  const [fields, waivers, agreements, submissions] = await Promise.all([listAll("/customer_fields"), listAll("/waivers"), listAll("/waiver_agreements"), listAll("/customer_form_submissions")]);
  // Which field holds what: TeamUp marks its standard ones with system_use.
  const use = new Map<string, string>();
  for (const f of fields) if (f.system_use) use.set(String(f.id), String(f.system_use));
  const waiverName = new Map<string, string>();
  for (const w of waivers) waiverName.set(String(w.id), String(w.name ?? "Waiver"));
  const out = new Map<string, Omit<Safety, "syncedAt">>();
  const at = (id: string) => out.get(id) ?? out.set(id, {}).get(id)!;
  for (const a of agreements) {
    const id = String(a.customer ?? "");
    const signed = str(a.signed_at);
    if (!id || !signed) continue;
    const cur = at(id);
    if (!cur.waiverSignedAt || signed > cur.waiverSignedAt) { cur.waiverSignedAt = new Date(signed).toISOString(); cur.waiverName = waiverName.get(String(a.waiver)); }
  }
  for (const sub of submissions) {
    const id = String(sub.customer ?? "");
    if (!id) continue;
    const cur = at(id);
    for (const v of (sub.latest_values as Json[]) ?? []) {
      const kind = use.get(String(v.field));
      const value = typeof v.value === "string" ? str(v.value) : undefined;
      const when = str(v.last_updated_at ?? v.created_at);
      if (when && (!cur.formAt || when > cur.formAt)) cur.formAt = when;
      if (!value) continue;
      if (kind === "emergency_contact_name") cur.emergencyName = value;
      else if (kind === "emergency_contact_phone") cur.emergencyPhone = value;
      else if (kind === "emergency_contact_relationship") cur.emergencyRelationship = value;
      else if (kind === "date_of_birth") cur.dateOfBirth = value;
    }
  }
  for (const v of out.values()) if (v.formAt) v.formAt = new Date(v.formAt).toISOString();
  return out;
}

/** The nightly "safety" stage. */
export async function refreshSafety() {
  if (!teamupConfigured()) return { count: 0, skipped: "TeamUp isn’t configured" };
  const byCustomer = await fetchSafety();
  const count = await applyMany((s) => recordSafety(s, byCustomer));
  let waivers = 0, emergency = 0;
  for (const v of byCustomer.values()) { if (v.waiverSignedAt) waivers++; if (v.emergencyPhone) emergency++; }
  return { count, customers: byCustomer.size, waivers, emergency };
}

export const hasWaiver = (c: Contact) => Boolean(c.safety?.waiverSignedAt);
export const hasEmergency = (c: Contact) => Boolean(c.safety?.emergencyPhone || c.safety?.emergencyName);

// ---- Who's in the gym now ----
//
// Sammy, 10/10/2026: the point is to tell whoever has the CRM open that
// someone is in the gym without a waiver (or emergency contact), so they can
// go and talk to them, then tick "Spoke to them" and the alert clears. The
// window is at most 1.5 hours: Kisi logs people coming in, not leaving.

export const MAX_WINDOW_HOURS = 1.5;
const CACHE_MS = 2 * 60e3; // TeamUp and Kisi are read at most every two minutes, however many screens are open

export interface UpcomingEvent { id: string; name: string; startsAt: string; endsAt: string }

/** Saved by the activity stage: events in the next two days, so the live check needn't page the whole list. */
export async function saveUpcomingEvents(events: Json[]) {
  const from = Date.now() - 6 * 3600e3, to = Date.now() + 2 * 86400e3;
  const upcoming: UpcomingEvent[] = [];
  for (const e of events) {
    const t = Date.parse(String(e.starts_at ?? ""));
    if (!t || t < from || t > to || e.status === "cancelled") continue;
    upcoming.push({ id: String(e.id), name: String(e.name ?? "Class"), startsAt: new Date(t).toISOString(), endsAt: new Date(Date.parse(String(e.ends_at ?? "")) || t + 3600e3).toISOString() });
  }
  await db().from("sync_payloads").upsert({ key: "activity:upcoming", value: upcoming, updated_at: new Date().toISOString() });
  return upcoming.length;
}

async function eventsNow(): Promise<UpcomingEvent[]> {
  const { data } = await db().from("sync_payloads").select("value, updated_at").eq("key", "activity:upcoming").maybeSingle();
  let events = (data?.value as UpcomingEvent[] | null) ?? [];
  const fresh = data && Date.now() - Date.parse(data.updated_at as string) < 30 * 3600e3;
  if (!fresh) {
    // No nightly copy (or a stale one): read the whole list now. A few seconds, once.
    const all = await listAll("/events");
    await saveUpcomingEvents(all);
    events = all.map((e) => ({ id: String(e.id), name: String(e.name ?? "Class"), startsAt: new Date(Date.parse(String(e.starts_at ?? "")) || 0).toISOString(), endsAt: new Date(Date.parse(String(e.ends_at ?? "")) || 0).toISOString() })).filter((e) => Date.parse(e.startsAt) > 0);
  }
  const now = Date.now();
  // On now: started (or starts within 15 minutes) and not over by more than 20 minutes.
  return events.filter((e) => Date.parse(e.startsAt) <= now + 15 * 60e3 && Date.parse(e.endsAt) >= now - 20 * 60e3);
}

type Via = { kind: "class"; event: string; at: string; status: "attended" | "registered" } | { kind: "door"; at: string };
/** Who came in, before joining to the CRM's contacts. Cached for two minutes. */
interface Presence { key: string; customerId?: string; email?: string; name: string; via: Via[] }

async function presence(windowHours: number): Promise<{ list: Presence[]; classes: UpcomingEvent[]; kisi: boolean; at: string }> {
  const cacheKey = `safety:in_now:${windowHours}`;
  const { data: cached } = await db().from("sync_payloads").select("value, updated_at").eq("key", cacheKey).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.updated_at as string) < CACHE_MS) return cached.value as { list: Presence[]; classes: UpcomingEvent[]; kisi: boolean; at: string };

  const windowMs = windowHours * 3600e3;
  const people = new Map<string, Presence>();
  const at = (key: string, init: Omit<Presence, "key" | "via">) => people.get(key) ?? people.set(key, { key, ...init, via: [] }).get(key)!;
  const classes = teamupConfigured() ? await eventsNow() : [];
  if (classes.length) {
    const pages = await Promise.all(classes.map((e) => fetchJson("/attendances", { event: e.id, page_size: "100" }) as Promise<Json>));
    classes.forEach((e, i) => {
      for (const a of (pages[i].results as Json[]) ?? []) {
        const status = String(a.status ?? "");
        if (status !== "attended" && status !== "registered") continue;
        const cid = String(a.customer ?? "");
        at(`tu:${cid}`, { customerId: cid, name: `TeamUp customer ${cid}` }).via.push({ kind: "class", event: e.name, at: e.startsAt, status });
      }
    });
  }
  const kisi = kisiConfigured();
  if (kisi) {
    const H = { Authorization: `KISI-LOGIN ${process.env.KISI_API_KEY}`, Accept: "application/json", "Content-Type": "application/json" };
    const from = new Date(Date.now() - windowMs).toISOString(), to = new Date().toISOString();
    type Set_ = { id: number; cursor?: string | null; events?: { success?: boolean; created_at: string; actor_email?: string | null; actor_name?: string | null }[] };
    const res = await fetch("https://api.kisi.io/event_sets", { method: "POST", headers: H, body: JSON.stringify({ event_set: { interval: `${from}/${to}`, event_type: "lock.unlock", event_success: true } }), cache: "no-store" });
    if (!res.ok) throw new Error(`Kisi ${res.status} reading door entries`);
    let page = (await res.json()) as Set_;
    for (let n = 0; n < 20; n++) {
      for (const e of page.events ?? []) {
        if (e.success === false) continue;
        const email = (e.actor_email ?? "").toLowerCase();
        at(`k:${email || e.actor_name || "unknown"}`, { email: email || undefined, name: e.actor_name || email || "Unknown fob" }).via.push({ kind: "door", at: new Date(e.created_at).toISOString() });
      }
      if (!page.cursor || !page.events?.length) break;
      const prev = page.cursor;
      const r = await fetch(`https://api.kisi.io/event_sets/${page.id}?limit=200&cursor=${encodeURIComponent(prev)}`, { headers: H, cache: "no-store" });
      if (!r.ok) break;
      page = (await r.json()) as Set_;
      if (page.cursor === prev) break;
    }
  }
  const value = { list: [...people.values()], classes, kisi, at: new Date().toISOString() };
  await db().from("sync_payloads").upsert({ key: cacheKey, value, updated_at: value.at });
  return value;
}

type ContactRow = { id: string; name: string; phone: string | null; email: string | null; teamup: { customerId?: string } | null; membership: { customerId?: string } | null; safety: Safety | null };
async function contactRows(): Promise<ContactRow[]> {
  const rows: ContactRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from("contacts").select("id, name, phone, email, teamup, membership, safety").range(from, from + 999);
    if (error) throw new Error(`Loading contacts: ${error.message}`);
    rows.push(...((data ?? []) as ContactRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/** Ticks for people who aren't CRM contacts (a TeamUp customer or Kisi fob we can't match), for today only. */
async function acksToday(): Promise<string[]> {
  const { data } = await db().from("sync_payloads").select("value").eq("key", "safety:acks").maybeSingle();
  const v = data?.value as { date?: string; keys?: string[] } | null;
  return v?.date === ukParts(Date.now()).date ? v.keys ?? [] : [];
}
export async function ackUnknown(key: string) {
  const keys = await acksToday();
  await db().from("sync_payloads").upsert({ key: "safety:acks", value: { date: ukParts(Date.now()).date, keys: [...new Set([...keys, key])] }, updated_at: new Date().toISOString() });
}

export interface PersonIn {
  key: string;
  contactId?: string;
  name: string;
  phone?: string;
  via: Via[];
  waiver?: string; // signed at
  emergency?: { name?: string; phone?: string; relationship?: string };
  missing: ("waiver" | "emergency")[];
  checkedAt?: string; // staff spoke to them today
  unknown?: boolean; // not matched to a CRM contact
}

/** Everyone in the gym now (class on, or through the door within the window), gaps first. */
export async function whoIsIn(windowHours = MAX_WINDOW_HOURS): Promise<{ people: PersonIn[]; classes: UpcomingEvent[]; window: number; kisi: boolean; teamup: boolean; at: string }> {
  const w = Math.min(MAX_WINDOW_HOURS, Math.max(0.25, windowHours));
  const [p, rows, acks] = await Promise.all([presence(w), contactRows(), acksToday()]);
  const byCustomer = new Map<string, ContactRow>(), byEmail = new Map<string, ContactRow>();
  for (const c of rows) {
    const cid = c.teamup?.customerId ?? c.membership?.customerId;
    if (cid) byCustomer.set(cid, c);
    if (c.email) byEmail.set(c.email.toLowerCase(), c);
  }
  const today = ukParts(Date.now()).date;
  const merged = new Map<string, PersonIn>();
  for (const x of p.list) {
    const c = (x.customerId && byCustomer.get(x.customerId)) || (x.email && byEmail.get(x.email)) || undefined;
    const key = c ? `c:${c.id}` : x.key;
    const cur = merged.get(key);
    if (cur) { cur.via.push(...x.via); continue; }
    const s = c?.safety ?? undefined;
    const person: PersonIn = c
      ? { key, contactId: c.id, name: c.name, phone: c.phone || undefined, via: [...x.via], waiver: s?.waiverSignedAt, emergency: s ? { name: s.emergencyName, phone: s.emergencyPhone, relationship: s.emergencyRelationship } : undefined, missing: [], checkedAt: s?.checkedAt && ukParts(Date.parse(s.checkedAt)).date === today ? s.checkedAt : undefined }
      : { key, name: x.name, via: [...x.via], missing: [], unknown: true, checkedAt: acks.includes(key) ? "today" : undefined };
    if (!person.waiver) person.missing.push("waiver");
    if (!person.emergency?.phone && !person.emergency?.name) person.missing.push("emergency");
    merged.set(key, person);
  }
  const rank = (x: PersonIn) => (x.missing.length && !x.checkedAt ? 0 : x.missing.length ? 1 : 2);
  const people = [...merged.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return { people, classes: p.classes, window: w, kisi: p.kisi, teamup: teamupConfigured(), at: p.at };
}
