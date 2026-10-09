// The nightly TeamUp sync, in stages so no single call goes near Vercel's
// 60-second limit (Sammy, 09/10/2026). Server-only. Called by
// /api/cron?job=teamup&stage=<stage> from pg_cron a couple of minutes
// apart, and by the TeamUp webhook for one customer.
//
//   customers   read every customer from TeamUp          → sync_payloads
//   members     read memberships and categories          → sync_payloads
//   payments    read payment subscriptions and invoices  → sync_payloads
//   apply       run importCustomers / importMembers / checkMembershipsEnding
//               on the saved payloads, keep the raw copy
//   attendance  this week's sessions for the accountability programme
//
// `?job=teamup` with no stage runs them all in turn (manual runs, and the
// old schedule). Each stage records how long it took in settings
// `teamup_sync`, shown on the Members screen so a creep towards the limit
// is visible long before it bites.

import { checkMembershipsEnding, importCustomers, importMembers, type CustomerInput, type MemberInput } from "@/lib/engine";
import { attachPayments, fetchCustomerMembers, fetchCustomers, fetchMembers, fetchPaymentInfo, paymentInfoToJson, teamupConfigured, type PaymentInfoJson } from "./teamup";
import { applyMany } from "./state";
import { db } from "./supabase";
import { refreshAttendance } from "./accountability";

export const STAGES = ["customers", "members", "payments", "apply", "attendance"] as const;
export type Stage = (typeof STAGES)[number];

type RawRow = { id: string; customer_id: string; raw: Record<string, unknown> };
type StageInfo = { at: string; ms: number; ok: boolean; count?: number; error?: string };

async function payload<T>(key: string): Promise<{ value: T; at: string } | null> {
  const { data } = await db().from("sync_payloads").select("value, updated_at").eq("key", key).maybeSingle();
  return data ? { value: data.value as T, at: data.updated_at as string } : null;
}
async function savePayload(key: string, value: unknown) {
  const { error } = await db().from("sync_payloads").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Saving ${key}: ${error.message}`);
}

async function status(): Promise<Record<string, unknown>> {
  const { data } = await db().from("settings").select("value").eq("id", "teamup_sync").maybeSingle();
  return (data?.value as Record<string, unknown>) ?? {};
}
async function recordStage(stage: Stage, info: StageInfo, extra: Record<string, unknown> = {}) {
  const cur = await status();
  const stages = { ...((cur.stages as Record<string, StageInfo>) ?? {}), [stage]: info };
  const value = { ...cur, ...extra, stages, lastStage: stage, lastStageAt: info.at };
  await db().from("settings").upsert({ id: "teamup_sync", value, updated_at: info.at });
}

const FRESH_MS = 6 * 3600e3; // apply only uses payloads read in the last six hours

/** Runs one stage, timing it and recording the outcome. */
export async function runStage(stage: Stage): Promise<Record<string, unknown>> {
  if (!teamupConfigured()) return { ok: false, skipped: "TeamUp isn’t configured (TEAMUP_M2M_TOKEN, TEAMUP_PROVIDER_ID)" };
  const t0 = Date.now();
  const at = new Date(t0).toISOString();
  try {
    let result: Record<string, unknown> = {};
    if (stage === "customers") {
      const customers = await fetchCustomers();
      await savePayload("teamup:customers", customers);
      result = { count: customers.length };
    } else if (stage === "members") {
      const { members, raw } = await fetchMembers();
      await savePayload("teamup:members", { members, raw });
      result = { count: members.length };
    } else if (stage === "payments") {
      const payments = paymentInfoToJson(await fetchPaymentInfo());
      await savePayload("teamup:payments", payments);
      result = { count: Object.keys(payments.owed).length };
    } else if (stage === "apply") {
      const [c, m, pay] = await Promise.all([payload<CustomerInput[]>("teamup:customers"), payload<{ members: MemberInput[]; raw: RawRow[] }>("teamup:members"), payload<PaymentInfoJson>("teamup:payments")]);
      if (!c || !m || !pay) throw new Error("Nothing to apply: the customers, members or payments stage hasn’t run");
      const stale = [c.at, m.at, pay.at].filter((x) => Date.now() - Date.parse(x) > FRESH_MS);
      if (stale.length) throw new Error(`Payloads are stale (${stale.map((x) => x.slice(0, 16)).join(", ")}): run the earlier stages first`);
      attachPayments(m.value.members, pay.value);
      const applied = await applyMany((s) => {
        // The first ever sync just records what's there, without messaging anyone.
        const baseline = !s.contacts.some((x) => x.membership);
        const people = importCustomers(s, c.value);
        const counts = importMembers(s, m.value.members, { baseline });
        const ending = baseline ? 0 : checkMembershipsEnding(s);
        return { ...counts, customers: c.value.length, customersAdded: people.added, ending, baseline, members: m.value.members.length };
      });
      if (m.value.raw.length) {
        const { error } = await db().from("teamup_members").upsert(m.value.raw.map((r) => ({ ...r, synced_at: at })));
        if (error) console.error("[teamup] raw copy", error.message);
      }
      result = { ...applied, count: m.value.members.length };
    } else if (stage === "attendance") {
      result = await refreshAttendance();
      result.count = (result.refreshed as number) ?? 0;
    }
    const ms = Date.now() - t0;
    await recordStage(stage, { at, ms, ok: true, count: result.count as number | undefined }, stage === "apply" ? { lastRun: at, ok: true, ...result } : {});
    return { ok: true, stage, ms, ...result };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[teamup] ${stage} failed`, error);
    await recordStage(stage, { at, ms: Date.now() - t0, ok: false, error }, stage === "apply" ? { lastRun: at, ok: false, error } : {});
    return { ok: false, stage, error };
  }
}

/** All four stages in turn (manual runs). Each is still timed on its own. */
export async function syncTeamUp() {
  const out: Record<string, unknown> = { ok: true };
  for (const stage of STAGES) {
    const r = await runStage(stage);
    out[stage] = r;
    if (!r.ok) { out.ok = false; break; }
  }
  return out;
}

/** A webhook said something changed for one customer: re-read just them. */
export async function syncTeamUpCustomer(customerId: string) {
  if (!teamupConfigured()) return;
  const members = await fetchCustomerMembers(customerId);
  if (!members.length) return;
  await applyMany((s) => importMembers(s, members, { baseline: !s.contacts.some((c) => c.membership) }));
}
