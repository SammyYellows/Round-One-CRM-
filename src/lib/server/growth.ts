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
