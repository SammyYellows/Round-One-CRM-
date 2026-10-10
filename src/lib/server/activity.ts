// Sessions for every active member, nightly (improvement item 18, Sammy
// 10/10/2026): TeamUp's ticked-in attendances (with the event's time from
// the events list, since TeamUp ignores date filters) and Kisi's door
// entries for the last 60 days, one session per UK day per person. Then the
// inactivity alert. Server-only; the "activity" stage of the staged sync.

import { flagInactivity, recordActivity } from "@/lib/engine";
import { ukParts } from "@/lib/time";
import { fetchJson, teamupConfigured } from "./teamup";
import { kisiConfigured } from "./kisi";
import { applyMany, loadState } from "./state";
import { db } from "./supabase";

const DAYS = 60;
export const DEFAULT_INACTIVE_DAYS = 20;

type Json = Record<string, unknown>;

/** Every page of a TeamUp list, four pages at a time. (Copied from teamup.ts's list, which isn't exported.) */
async function listAll(path: string, params: Record<string, string>): Promise<Json[]> {
  const first = (await fetchJson(path, { page_size: "100", page: "1", ...params })) as Json;
  const out: Json[] = [...((first.results as Json[]) ?? [])];
  const pages = Math.ceil((Number(first.count ?? out.length) || out.length) / 100);
  for (let from = 2; from <= pages; from += 4) {
    const batch = await Promise.all(Array.from({ length: Math.min(4, pages - from + 1) }, (_, i) => fetchJson(path, { page_size: "100", page: String(from + i), ...params }) as Promise<Json>));
    for (const pg of batch) out.push(...((pg.results as Json[]) ?? []));
  }
  return out;
}

/** One class slot (name + weekday + start time) over the period, for the popular-classes report. */
export interface ClassStat { name: string; weekday: number; hour: number; minute: number; sessions: number; attended: number; avg: number; capacity?: number; fill?: number }

/** TeamUp: customer id → UK dates with a ticked-in class, last 60 days; plus per-class stats. */
async function teamupDays(sinceMs: number): Promise<{ days: Map<string, Set<string>>; classes: ClassStat[] }> {
  const days = new Map<string, Set<string>>();
  if (!teamupConfigured()) return { days, classes: [] };
  const [events, attended] = await Promise.all([listAll("/events", {}), listAll("/attendances", { status: "attended" })]);
  const when = new Map<string, number>();
  const slotOf = new Map<string, string>();
  const slots = new Map<string, ClassStat & { eventIds: Set<string> }>();
  for (const e of events) {
    const t = Date.parse(String(e.starts_at ?? ""));
    if (!t) continue;
    when.set(String(e.id), t);
    if (t < sinceMs || t > Date.now() || e.status === "cancelled") continue;
    const p = ukParts(t);
    const key = `${String(e.name ?? "Class")}|${p.weekday}|${p.hour}:${String(p.minute).padStart(2, "0")}`;
    slotOf.set(String(e.id), key);
    const cur = slots.get(key) ?? { name: String(e.name ?? "Class"), weekday: p.weekday, hour: p.hour, minute: p.minute, sessions: 0, attended: 0, avg: 0, capacity: Number(e.max_occupancy) || undefined, eventIds: new Set() };
    cur.sessions++;
    cur.eventIds.add(String(e.id));
    slots.set(key, cur);
  }
  for (const a of attended) {
    const t = when.get(String(a.event));
    if (!t || t < sinceMs || t > Date.now()) continue;
    const id = String(a.customer);
    (days.get(id) ?? days.set(id, new Set()).get(id)!).add(ukParts(t).date);
    const key = slotOf.get(String(a.event));
    if (key) slots.get(key)!.attended++;
  }
  const classes = [...slots.values()].map(({ eventIds: _e, ...s }) => ({ ...s, avg: s.sessions ? Math.round((s.attended / s.sessions) * 10) / 10 : 0, fill: s.capacity && s.sessions ? Math.round((s.attended / (s.sessions * s.capacity)) * 100) : undefined })).sort((a, b) => b.avg - a.avg);
  return { days, classes };
}

/** Kisi: email → UK dates with a door entry, last 60 days (one org-wide event set). */
async function kisiDays(sinceMs: number): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (!kisiConfigured()) return out;
  const H = { Authorization: `KISI-LOGIN ${process.env.KISI_API_KEY}`, Accept: "application/json", "Content-Type": "application/json" };
  const from = new Date(Math.max(sinceMs, Date.now() - 89 * 86400e3)).toISOString(), to = new Date().toISOString();
  type Set_ = { id: number; status: string; cursor?: string | null; events?: { type: string; success?: boolean; created_at: string; actor_email?: string | null }[] };
  const res = await fetch("https://api.kisi.io/event_sets", { method: "POST", headers: H, body: JSON.stringify({ event_set: { interval: `${from}/${to}`, event_type: "lock.unlock", event_success: true } }), cache: "no-store" });
  if (!res.ok) throw new Error(`Kisi ${res.status} creating the event set`);
  let page = (await res.json()) as Set_;
  const setId = page.id;
  for (let n = 0; n < 60; n++) {
    for (const e of page.events ?? []) {
      const email = (e.actor_email ?? "").toLowerCase();
      if (!email || e.success === false) continue;
      (out.get(email) ?? out.set(email, new Set()).get(email)!).add(ukParts(Date.parse(e.created_at)).date);
    }
    if (!page.cursor || !page.events?.length) break;
    const prev = page.cursor;
    const r = await fetch(`https://api.kisi.io/event_sets/${setId}?limit=200&cursor=${encodeURIComponent(prev)}`, { headers: H, cache: "no-store" });
    if (!r.ok) break;
    page = (await r.json()) as Set_;
    if (page.cursor === prev) break;
  }
  return out;
}

export async function inactiveDays(): Promise<number> {
  const { data } = await db().from("settings").select("value").eq("id", "inactivity").maybeSingle();
  const n = Number((data?.value as { days?: number } | null)?.days);
  return Number.isFinite(n) && n >= 3 ? Math.min(365, Math.round(n)) : DEFAULT_INACTIVE_DAYS;
}

/** The nightly "activity" stage: read, record, alert. */
export async function refreshActivity() {
  const since = Date.now() - DAYS * 86400e3;
  const [{ days: tuDays, classes }, ki, s, days] = await Promise.all([teamupDays(since), kisiDays(since).catch((e) => { console.error("[activity] kisi", e instanceof Error ? e.message : e); return new Map<string, Set<string>>(); }), loadState(), inactiveDays()]);
  const tu = tuDays;
  await db().from("sync_payloads").upsert({ key: "activity:classes", value: { since: new Date(since).toISOString(), classes }, updated_at: new Date().toISOString() });
  const byContact = new Map<string, string[]>();
  for (const c of s.contacts) {
    if (c.membership?.status !== "active") continue;
    const set = new Set<string>();
    const cid = c.teamup?.customerId ?? c.membership.customerId;
    for (const d of tu.get(cid) ?? []) set.add(d);
    for (const d of ki.get(c.email.toLowerCase()) ?? []) set.add(d);
    byContact.set(c.id, [...set]);
  }
  const baseline = !s.contacts.some((c) => c.activity);
  const alerted = await applyMany((st) => { recordActivity(st, byContact); return flagInactivity(st, days, { baseline }); });
  return { count: byContact.size, alerted, baseline, inactiveDays: days, teamupPeople: tu.size, kisiPeople: ki.size };
}

/** The saved per-class stats (last 60 days), for Reports. */
export async function classStats(): Promise<{ since?: string; classes: ClassStat[] }> {
  const { data } = await db().from("sync_payloads").select("value").eq("key", "activity:classes").maybeSingle();
  return (data?.value as { since?: string; classes: ClassStat[] } | null) ?? { classes: [] };
}
