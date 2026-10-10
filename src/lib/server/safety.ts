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
import { applyMany, loadState } from "./state";
import { db } from "./supabase";
import { fetchJson, teamupConfigured } from "./teamup";

type Json = Record<string, unknown>;

async function listAll(path: string, params: Record<string, string> = {}): Promise<Json[]> {
  const first = (await fetchJson(path, { page_size: "100", page: "1", ...params })) as Json;
  const out: Json[] = [...((first.results as Json[]) ?? [])];
  const pages = Math.ceil((Number(first.count ?? out.length) || out.length) / 100);
  for (let from = 2; from <= pages; from += 4) {
    const batch = await Promise.all(Array.from({ length: Math.min(4, pages - from + 1) }, (_, i) => fetchJson(path, { page_size: "100", page: String(from + i), ...params }) as Promise<Json>));
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

async function eventsNow(windowMs: number): Promise<UpcomingEvent[]> {
  const { data } = await db().from("sync_payloads").select("value, updated_at").eq("key", "activity:upcoming").maybeSingle();
  let events = (data?.value as UpcomingEvent[] | null) ?? [];
  const fresh = data && Date.now() - Date.parse(data.updated_at as string) < 30 * 3600e3;
  if (!fresh) {
    // No nightly copy (or a stale one): read the whole list now. Slower (a few seconds) but right.
    const all = await listAll("/events");
    await saveUpcomingEvents(all);
    events = all.map((e) => ({ id: String(e.id), name: String(e.name ?? "Class"), startsAt: new Date(Date.parse(String(e.starts_at ?? "")) || 0).toISOString(), endsAt: new Date(Date.parse(String(e.ends_at ?? "")) || 0).toISOString() })).filter((e) => Date.parse(e.startsAt) > 0);
  }
  const now = Date.now();
  // Classes that started within the window and haven't been over for more than 20 minutes, plus ones starting in the next 15 minutes.
  return events.filter((e) => Date.parse(e.startsAt) <= now + 15 * 60e3 && Date.parse(e.endsAt) >= now - 20 * 60e3 && Date.parse(e.startsAt) >= now - windowMs);
}

export interface PersonIn {
  contactId?: string;
  name: string;
  phone?: string;
  via: { kind: "class"; event: string; at: string; status: "attended" | "registered" }[] | { kind: "door"; at: string }[] | ({ kind: "class"; event: string; at: string; status: "attended" | "registered" } | { kind: "door"; at: string })[];
  waiver?: string; // signed at
  emergency?: { name?: string; phone?: string; relationship?: string };
  missing: ("waiver" | "emergency")[];
  unknown?: string; // not matched to a CRM contact: the TeamUp id or Kisi email
}

/** Everyone who came in within the window (default 3 hours), worst gaps first. */
export async function whoIsIn(windowHours = 3): Promise<{ people: PersonIn[]; classes: UpcomingEvent[]; window: number; kisi: boolean; teamup: boolean }> {
  const windowMs = windowHours * 3600e3;
  const [s, classes] = await Promise.all([loadState(), teamupConfigured() ? eventsNow(windowMs) : Promise.resolve([] as UpcomingEvent[])]);
  const byCustomer = new Map<string, Contact>();
  const byEmail = new Map<string, Contact>();
  for (const c of s.contacts) {
    const cid = c.teamup?.customerId ?? c.membership?.customerId;
    if (cid) byCustomer.set(cid, c);
    if (c.email) byEmail.set(c.email.toLowerCase(), c);
  }
  const people = new Map<string, PersonIn>();
  const person = (key: string, c: Contact | undefined, unknown: string) => {
    const cur = people.get(key);
    if (cur) return cur;
    const p: PersonIn = c
      ? { contactId: c.id, name: c.name, phone: c.phone || undefined, via: [], waiver: c.safety?.waiverSignedAt, emergency: c.safety ? { name: c.safety.emergencyName, phone: c.safety.emergencyPhone, relationship: c.safety.emergencyRelationship } : undefined, missing: [] }
      : { name: unknown, via: [], missing: [], unknown };
    if (!p.waiver) p.missing.push("waiver");
    if (!p.emergency?.phone && !p.emergency?.name) p.missing.push("emergency");
    people.set(key, p);
    return p;
  };
  // Ticked in (or booked) to classes on now.
  if (classes.length) {
    const pages = await Promise.all(classes.map((e) => fetchJson("/attendances", { event: e.id, page_size: "100" }) as Promise<Json>));
    classes.forEach((e, i) => {
      for (const a of (pages[i].results as Json[]) ?? []) {
        const status = String(a.status ?? "");
        if (status !== "attended" && status !== "registered") continue;
        const cid = String(a.customer ?? "");
        const c = byCustomer.get(cid);
        const p = person(c ? `c:${c.id}` : `tu:${cid}`, c, `TeamUp customer ${cid}`);
        (p.via as { kind: "class"; event: string; at: string; status: "attended" | "registered" }[]).push({ kind: "class", event: e.name, at: e.startsAt, status });
      }
    });
  }
  // Through the door.
  let kisi = false;
  if (kisiConfigured()) {
    kisi = true;
    const H = { Authorization: `KISI-LOGIN ${process.env.KISI_API_KEY}`, Accept: "application/json", "Content-Type": "application/json" };
    const from = new Date(Date.now() - windowMs).toISOString(), to = new Date().toISOString();
    type Set_ = { id: number; cursor?: string | null; events?: { success?: boolean; created_at: string; actor_email?: string | null; actor_name?: string | null }[] };
    const res = await fetch("https://api.kisi.io/event_sets", { method: "POST", headers: H, body: JSON.stringify({ event_set: { interval: `${from}/${to}`, event_type: "lock.unlock", event_success: true } }), cache: "no-store" });
    if (!res.ok) throw new Error(`Kisi ${res.status} reading today's door entries`);
    let page = (await res.json()) as Set_;
    for (let n = 0; n < 20; n++) {
      for (const e of page.events ?? []) {
        if (e.success === false) continue;
        const email = (e.actor_email ?? "").toLowerCase();
        const c = email ? byEmail.get(email) : undefined;
        const p = person(c ? `c:${c.id}` : `k:${email || e.actor_name || "?"}`, c, e.actor_name || email || "Unknown fob");
        (p.via as { kind: "door"; at: string }[]).push({ kind: "door", at: new Date(e.created_at).toISOString() });
      }
      if (!page.cursor || !page.events?.length) break;
      const prev = page.cursor;
      const r = await fetch(`https://api.kisi.io/event_sets/${page.id}?limit=200&cursor=${encodeURIComponent(prev)}`, { headers: H, cache: "no-store" });
      if (!r.ok) break;
      page = (await r.json()) as Set_;
      if (page.cursor === prev) break;
    }
  }
  const list = [...people.values()].sort((a, b) => b.missing.length - a.missing.length || a.name.localeCompare(b.name));
  return { people: list, classes, window: windowHours, kisi, teamup: teamupConfigured() };
}
