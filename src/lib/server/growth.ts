// Membership growth, worked out from the TeamUp membership rows the nightly
// sync keeps in `teamup_members` (every membership TeamUp has ever had for
// us, with start and expiry dates). Server-only. Pure maths lives in the
// exported functions so the Reports screen and the PDF agree.
//
// A "member" is a person (TeamUp customer) with at least one membership
// running on a given day, so someone with three memberships counts once and
// an upgrade from one plan to another is not a leave and a join.

import { db } from "@/lib/server/supabase";

export interface MembershipRow {
  customerId: string;
  customerName: string;
  name: string; // the membership, e.g. "Premium Middleweight"
  start: string; // YYYY-MM-DD
  end: string | null; // expiration date, YYYY-MM-DD, or null while open-ended
  status: string; // active, cancelled, completed, hold
  cancelling: boolean;
}

export interface GrowthSettings {
  pastDays: number; // "the last N days" the weekly numbers look back over
  forecastDays: number; // how far ahead the weekly forecast looks
  averageDays: number; // how many past days the average that feeds the forecast is taken over
  monthlyMonths: number[]; // the monthly report's lookbacks, e.g. 2, 3 and 6 months
  forecastMonths: number[]; // the monthly report's forecasts, e.g. 2 and 3 months
  managerNumbers: string[]; // WhatsApp numbers the reports go to
  weeklyOn: boolean; // Monday 08:00 UK
  monthlyOn: boolean; // 1st of the month 08:00 UK
  unpaidOn: boolean; // Monday 08:00 UK: who hasn't paid (failed payments)
  lastWeeklyAt?: string;
  lastMonthlyAt?: string;
  lastUnpaidAt?: string;
}

export const DEFAULT_GROWTH: GrowthSettings = {
  pastDays: 30, forecastDays: 30, averageDays: 30, monthlyMonths: [2, 3, 6], forecastMonths: [2, 3],
  managerNumbers: [], weeklyOn: false, monthlyOn: false, unpaidOn: false,
};

export async function growthSettings(): Promise<GrowthSettings> {
  const { data } = await db().from("settings").select("value").eq("id", "growth_report").maybeSingle();
  return { ...DEFAULT_GROWTH, ...((data?.value as Partial<GrowthSettings>) ?? {}) };
}

export async function saveGrowthSettings(patch: Partial<GrowthSettings>) {
  const cur = await growthSettings();
  const next = { ...cur, ...patch };
  await db().from("settings").upsert({ id: "growth_report", value: next, updated_at: new Date().toISOString() });
  return next;
}

export async function loadMemberships(): Promise<MembershipRow[]> {
  const out: MembershipRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from("teamup_members").select("customer_id, raw").range(from, from + 999);
    if (error) throw new Error(`Reading memberships: ${error.message}`);
    for (const r of data ?? []) {
      const raw = r.raw as Record<string, unknown>;
      const start = typeof raw.start_date === "string" ? raw.start_date.slice(0, 10) : "";
      if (!start) continue;
      const cust = (raw.customer && typeof raw.customer === "object" ? raw.customer : {}) as Record<string, unknown>;
      out.push({
        customerId: String(r.customer_id),
        customerName: `${String(cust.first_name ?? "")} ${String(cust.last_name ?? "")}`.trim() || String(cust.email ?? "") || "Unknown",
        name: String(raw.name ?? ""),
        start,
        end: typeof raw.expiration_date === "string" ? raw.expiration_date.slice(0, 10) : null,
        status: String(raw.status ?? ""),
        cancelling: raw.is_set_for_cancellation === true,
      });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

// ---- Pure maths over the rows -------------------------------------------

export const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => day(Date.parse(d) + n * 86400e3);

/** Is this membership running on day d? Open-ended ones run until their expiry is set. */
const runningOn = (m: MembershipRow, d: string) => m.start <= d && (m.end === null || m.end > d);

/** The people who are members on day d. */
export function membersOn(rows: MembershipRow[], d: string): Set<string> {
  const s = new Set<string>();
  for (const m of rows) if (runningOn(m, d)) s.add(m.customerId);
  return s;
}

export interface Window { from: string; to: string; joined: number; left: number; net: number; membersAtEnd: number }

/** Joins, leaves and net change between two days (from exclusive, to inclusive). */
export function windowStats(rows: MembershipRow[], from: string, to: string): Window {
  const before = membersOn(rows, from);
  const after = membersOn(rows, to);
  let left = 0;
  for (const id of before) if (!after.has(id)) left++;
  // A join is someone who is a member at the end and wasn't at the start:
  // brand new people and people who came back after a gap.
  let joined = 0;
  for (const id of after) if (!before.has(id)) joined++;
  return { from, to, joined, left, net: after.size - before.size, membersAtEnd: after.size };
}

/** Members whose membership stops within `days` of `today` and nothing else runs on. */
export function droppingOff(rows: MembershipRow[], today: string, days: number): { customerId: string; name: string; membership: string; ends: string }[] {
  const horizon = addDays(today, days);
  const now = membersOn(rows, today);
  const later = membersOn(rows, horizon);
  const out: { customerId: string; name: string; membership: string; ends: string }[] = [];
  for (const id of now) {
    if (later.has(id)) continue;
    const last = rows.filter((m) => m.customerId === id && runningOn(m, today)).sort((a, b) => (b.end ?? "9").localeCompare(a.end ?? "9"))[0];
    if (last) out.push({ customerId: id, name: last.customerName, membership: last.name, ends: last.end ?? horizon });
  }
  return out.sort((a, b) => a.ends.localeCompare(b.ends));
}

export interface Weekly {
  asOf: string;
  members: number;
  joined: number;
  left: number;
  net: number;
  pastDays: number;
  droppingOff: { customerId: string; name: string; membership: string; ends: string }[];
  forecastDays: number;
  averageDays: number;
  forecastNet: number; // expected net change over forecastDays
  forecastMembers: number;
}

export function weekly(rows: MembershipRow[], today: string, s: GrowthSettings): Weekly {
  const w = windowStats(rows, addDays(today, -s.pastDays), today);
  const avg = windowStats(rows, addDays(today, -s.averageDays), today);
  const perDay = avg.net / Math.max(1, s.averageDays);
  const forecastNet = Math.round(perDay * s.forecastDays);
  return {
    asOf: today, members: w.membersAtEnd, joined: w.joined, left: w.left, net: w.net, pastDays: s.pastDays,
    droppingOff: droppingOff(rows, today, 30),
    forecastDays: s.forecastDays, averageDays: s.averageDays, forecastNet, forecastMembers: w.membersAtEnd + forecastNet,
  };
}

export interface MonthPoint { month: string; label: string; from: string; to: string; joined: number; left: number; net: number; membersAtEnd: number }

const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

/** One point per calendar month, the last `months` whole months before (and not including) today's month, plus the current month so far. */
export function monthly(rows: MembershipRow[], today: string, months: number): MonthPoint[] {
  const out: MonthPoint[] = [];
  const y = Number(today.slice(0, 4)), mo = Number(today.slice(5, 7));
  for (let i = months; i >= 0; i--) {
    const d = new Date(Date.UTC(y, mo - 1 - i, 1));
    const ym = d.toISOString().slice(0, 7);
    const firstDay = `${ym}-01`;
    const lastDay = i === 0 ? today : day(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    const w = windowStats(rows, addDays(firstDay, -1), lastDay);
    out.push({ ...w, month: ym, label: i === 0 ? `${monthLabel(ym)} so far` : monthLabel(ym), from: firstDay, to: lastDay });
  }
  return out;
}

export interface MonthlyForecast { months: number; perMonth: number; net: number; members: number }

/** Average monthly net change over the past `averageDays`, carried forward. */
export function monthlyForecast(rows: MembershipRow[], today: string, s: GrowthSettings): MonthlyForecast[] {
  const avg = windowStats(rows, addDays(today, -s.averageDays), today);
  const perMonth = (avg.net / Math.max(1, s.averageDays)) * 30.44;
  const members = membersOn(rows, today).size;
  return s.forecastMonths.map((months) => ({ months, perMonth, net: Math.round(perMonth * months), members: members + Math.round(perMonth * months) }));
}

/**
 * Why TeamUp's "active memberships" and the CRM's member counts differ
 * (Sammy, 09/10/2026): TeamUp counts memberships, the CRM counts people, and
 * the growth maths counts by dates. Shown quietly at the foot of Reports.
 */
export interface Reconciliation {
  activeMemberships: number; // TeamUp's own tile
  peopleActive: number; // people with at least one membership TeamUp calls active
  byDates: number; // people with a membership running today by start/expiry dates
  doubles: { customerId: string; name: string; memberships: string[] }[]; // people holding two or more active memberships
  lapsedButActive: { customerId: string; name: string; membership: string; ended: string }[]; // TeamUp says active, expiry date has passed
}

export function reconcile(rows: MembershipRow[], today: string): Reconciliation {
  const active = rows.filter((m) => m.status === "active");
  const byPerson = new Map<string, MembershipRow[]>();
  for (const m of active) byPerson.set(m.customerId, [...(byPerson.get(m.customerId) ?? []), m]);
  const doubles = [...byPerson.entries()].filter(([, ms]) => ms.length > 1).map(([customerId, ms]) => ({ customerId, name: ms[0].customerName, memberships: ms.map((m) => m.name) })).sort((a, b) => b.memberships.length - a.memberships.length || a.name.localeCompare(b.name));
  const running = membersOn(rows, today);
  const lapsedButActive = [...byPerson.entries()].filter(([id]) => !running.has(id)).map(([customerId, ms]) => { const m = ms.sort((a, b) => (b.end ?? "").localeCompare(a.end ?? ""))[0]; return { customerId, name: m.customerName, membership: m.name, ended: m.end ?? "" }; });
  return { activeMemberships: active.length, peopleActive: byPerson.size, byDates: running.size, doubles, lapsedButActive };
}

// ---- Last month in detail (Sammy, 15/10/2026) ----------------------------

export interface PersonInfo { gender?: string; dateOfBirth?: string; area?: string }
export interface Split { label: string; count: number }
export interface MonthDetail {
  label: string; from: string; to: string;
  membersAtEnd: number; joined: number; left: number; net: number;
  threeMonthNet: number; threeMonthJoined: number; threeMonthLeft: number;
  types: { name: string; atEnd: number; joined: number; left: number }[]; // memberships, by name
  gender: Split[]; age: Split[]; areas: Split[]; // of the members at the end of the month
}

const AGE_BANDS: [string, number, number][] = [["Under 18", 0, 17], ["18–24", 18, 24], ["25–34", 25, 34], ["35–44", 35, 44], ["45–54", 45, 54], ["55+", 55, 200]];

function ageOn(dob: string, d: string) {
  const [y, m, dd] = dob.slice(0, 10).split("-").map(Number);
  const [Y, M, D] = d.split("-").map(Number);
  if (!y || !m || !dd) return undefined;
  return Y - y - (M < m || (M === m && D < dd) ? 1 : 0);
}

function tally(values: string[], order?: string[]): Split[] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  const out = [...m.entries()].map(([label, count]) => ({ label, count }));
  return order ? out.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : out.sort((a, b) => b.count - a.count);
}

/** The last whole calendar month before `today`: who joined and left on which membership, and who the members were. */
export function lastMonthDetail(rows: MembershipRow[], today: string, people: Map<string, PersonInfo>): MonthDetail {
  const months = monthly(rows, today, 3);
  const whole = months.slice(0, -1); // the three whole months before this one
  const m = whole[whole.length - 1];
  const before = membersOn(rows, addDays(m.from, -1));
  const after = membersOn(rows, m.to);
  const running = (d: string) => rows.filter((r) => runningOn(r, d));
  const types = new Map<string, { atEnd: number; joined: number; left: number }>();
  // Each Program intake has its own dated name in TeamUp ("28 Day Program - 28/09 - 26/10"); one row for them all.
  const key = (n: string) => (/^28\s*day\s*program/i.test(n) ? "28 Day Program (all intakes)" : n || "Unnamed");
  const at = (n: string) => { const k = key(n); return types.get(k) ?? types.set(k, { atEnd: 0, joined: 0, left: 0 }).get(k)!; };
  for (const r of running(m.to)) {
    at(r.name).atEnd++;
    if (!before.has(r.customerId)) at(r.name).joined++;
  }
  for (const r of running(addDays(m.from, -1))) if (!after.has(r.customerId)) at(r.name).left++;
  const members = [...after].map((id) => people.get(id) ?? {});
  const norm = (g?: string) => (!g ? "Not given" : /^m(ale)?$/i.test(g) ? "Male" : /^f(emale)?$/i.test(g) ? "Female" : g.charAt(0).toUpperCase() + g.slice(1));
  const band = (p: PersonInfo) => {
    const a = p.dateOfBirth ? ageOn(p.dateOfBirth, m.to) : undefined;
    return a === undefined || a < 5 || a > 100 ? "Not given" : AGE_BANDS.find(([, lo, hi]) => a >= lo && a <= hi)![0];
  };
  const areas = tally(members.map((p) => p.area ?? "Not given").filter((a) => a !== "Not given"));
  return {
    label: m.label, from: m.from, to: m.to, membersAtEnd: m.membersAtEnd, joined: m.joined, left: m.left, net: m.net,
    threeMonthNet: whole.reduce((a, x) => a + x.net, 0), threeMonthJoined: whole.reduce((a, x) => a + x.joined, 0), threeMonthLeft: whole.reduce((a, x) => a + x.left, 0),
    types: [...types.entries()].map(([name, v]) => ({ name, ...v })).filter((t) => t.atEnd || t.joined || t.left).sort((a, b) => b.atEnd - a.atEnd || b.joined - a.joined),
    gender: tally(members.map((p) => norm(p.gender))),
    age: tally(members.map(band), [...AGE_BANDS.map((b) => b[0]), "Not given"]),
    areas: [...areas.slice(0, 10), ...(members.length - areas.slice(0, 10).reduce((a, x) => a + x.count, 0) > 0 ? [{ label: "Other or none", count: members.length - areas.slice(0, 10).reduce((a, x) => a + x.count, 0) }] : [])],
  };
}
