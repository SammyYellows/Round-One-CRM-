// The nightly TeamUp sync: read every membership, apply it to the CRM, fire
// the "ending soon" checks, and keep a raw copy for checking the mapping.
// Server-only. Called by /api/cron?job=teamup and by the TeamUp webhook.

import { checkMembershipsEnding, importMembers } from "@/lib/engine";
import { fetchCustomerMembers, fetchMembers, teamupConfigured } from "./teamup";
import { applyMany } from "./state";
import { db } from "./supabase";

export async function syncTeamUp() {
  if (!teamupConfigured()) return { ok: false, skipped: "TeamUp isn’t configured (TEAMUP_M2M_TOKEN, TEAMUP_PROVIDER_ID)" };
  const startedAt = new Date().toISOString();
  try {
    const { members, raw } = await fetchMembers();
    const result = await applyMany((s) => {
      // The first ever sync just records what's there, without messaging anyone.
      const baseline = !s.contacts.some((c) => c.membership);
      const counts = importMembers(s, members, { baseline });
      const ending = baseline ? 0 : checkMembershipsEnding(s);
      return { ...counts, ending, baseline, members: members.length };
    });
    if (raw.length) {
      const { error } = await db().from("teamup_members").upsert(raw.map((r) => ({ ...r, synced_at: startedAt })));
      if (error) console.error("[teamup] raw copy", error.message);
    }
    await db().from("settings").upsert({ id: "teamup_sync", value: { lastRun: startedAt, ok: true, ...result }, updated_at: startedAt });
    return { ok: true, ...result };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[teamup] sync failed", error);
    await db().from("settings").upsert({ id: "teamup_sync", value: { lastRun: startedAt, ok: false, error }, updated_at: startedAt });
    return { ok: false, error };
  }
}

/** A webhook said something changed for one customer: re-read just them. */
export async function syncTeamUpCustomer(customerId: string) {
  if (!teamupConfigured()) return;
  const members = await fetchCustomerMembers(customerId);
  if (!members.length) return;
  await applyMany((s) => importMembers(s, members, { baseline: !s.contacts.some((c) => c.membership) }));
}
