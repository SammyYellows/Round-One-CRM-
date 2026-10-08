// The accountability programme's clockwork (docs/accountability.md).
// Every 5 minutes from /api/cron: refresh attendance for anyone whose
// weekly check-in is due, then send the check-ins that are due. Nightly
// from the TeamUp sync: refresh attendance for everyone on the programme.
// Server-only; the maths is in the engine.

import { dueCheckins, recordAttendance, sendCheckins } from "@/lib/engine";
import { applyMany, loadState } from "./state";
import { fetchAttendance } from "./attendance";
import { teamupConfigured } from "./teamup";

const TWO_WEEKS = 15 * 86400e3;

async function attendanceFor(ids: { contactId: string; customerId: string }[]) {
  const out: { contactId: string; sessions: { at: string; status: string }[] }[] = [];
  for (const { contactId, customerId } of ids) {
    try {
      out.push({ contactId, sessions: await fetchAttendance(customerId, Date.now() - TWO_WEEKS) });
    } catch (e) {
      console.error("[accountability] attendance", customerId, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

/** Everyone active on the programme with a TeamUp id. */
const roster = (s: Awaited<ReturnType<typeof loadState>>) =>
  s.contacts.filter((c) => c.accountability?.active).map((c) => ({ contactId: c.id, customerId: c.teamup?.customerId ?? c.membership?.customerId ?? "" })).filter((x) => x.customerId);

/** Nightly, and from the Refresh button: this week's and last week's sessions for everyone on the programme. */
export async function refreshAttendance() {
  if (!teamupConfigured()) return { refreshed: 0 };
  const s = await loadState();
  const fetched = await attendanceFor(roster(s));
  if (!fetched.length) return { refreshed: 0 };
  await applyMany((st) => { for (const f of fetched) recordAttendance(st, f.contactId, f.sessions); });
  return { refreshed: fetched.length };
}

/** Called from /api/cron: fresh attendance for whoever is due, then their check-in. */
export async function accountabilityTick() {
  const s = await loadState();
  const due = dueCheckins(s);
  if (!due.length) return { sent: 0 };
  const fetched = teamupConfigured() ? await attendanceFor(roster(s).filter((r) => due.some((c) => c.id === r.contactId))) : [];
  const sent = await applyMany((st) => {
    for (const f of fetched) recordAttendance(st, f.contactId, f.sessions);
    return sendCheckins(st);
  });
  return { sent };
}
