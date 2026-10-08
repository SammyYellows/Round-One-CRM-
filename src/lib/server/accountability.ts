// The accountability programme's clockwork (docs/accountability.md).
// Every 5 minutes from /api/cron: refresh attendance for anyone whose
// weekly check-in is due, then send the check-ins that are due. Nightly
// from the TeamUp sync: refresh attendance for everyone on the programme.
// Server-only; the maths is in the engine.

import { dueCheckins, dueNudges, flagSilence, recordAttendance, sendCheckins, sendNudges, setCheckinAi } from "@/lib/engine";
import { aiConfigured, readCheckin } from "./ai";
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

/** Called from /api/cron: fresh attendance for whoever is due, then their check-in, nudges and the silence signal. */
export async function accountabilityTick() {
  const s = await loadState();
  const due = [...dueCheckins(s), ...dueNudges(s)];
  if (!due.length && !s.contacts.some((c) => c.accountability?.active)) return { sent: 0, nudged: 0, silent: 0 };
  const fetched = due.length && teamupConfigured() ? await attendanceFor(roster(s).filter((r) => due.some((c) => c.id === r.contactId))) : [];
  return applyMany((st) => {
    for (const f of fetched) recordAttendance(st, f.contactId, f.sessions);
    return { sent: sendCheckins(st), nudged: sendNudges(st), silent: flagSilence(st) };
  });
}

/** After a check-in lands: Claude reads it and suggests a reply, stored for staff to approve. Called by the form submit route. */
export async function readLatestCheckin(contactId: string) {
  if (!aiConfigured()) return { skipped: "no AI key" };
  const s = await loadState();
  const c = s.contacts.find((x) => x.id === contactId);
  const a = c?.accountability;
  const k = a?.checkins?.[0];
  if (!c || !a || !k || k.ai) return { skipped: "nothing to read" };
  const ai = await readCheckin({
    first: c.firstName || c.name.split(" ")[0], floor: a.floor, stretch: a.stretch, why: a.why, style: a.style,
    thisWeek: a.attendance?.thisWeek ?? 0, lastWeek: a.attendance?.lastWeek ?? 0,
    feel: k.feel, blocker: k.blocker, play: k.play,
    recent: (a.checkins ?? []).slice(1, 4).map((x) => `${x.week}: ${x.feel}, ${x.play}`),
  });
  await applyMany((st) => setCheckinAi(st, contactId, k.at, ai));
  return { ok: true, status: ai.status };
}
