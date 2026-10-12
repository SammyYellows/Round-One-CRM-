// Member numbers for Today (Sammy, 12/10/2026): the same counts as Reports'
// weekly report and its members-at-month-end chart, for every staff login.
// Counts only: no names, no money.

import { requireStaff } from "@/lib/server/staff";
import { day, growthSettings, loadMemberships, monthly, weekly } from "@/lib/server/growth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const [rows, settings] = await Promise.all([loadMemberships(), growthSettings()]);
  const today = day(Date.now());
  const w = weekly(rows, today, settings);
  return Response.json({
    asOf: today, members: w.members, joined: w.joined, left: w.left, net: w.net, pastDays: w.pastDays,
    droppingOff: w.droppingOff.length, forecastDays: w.forecastDays, forecastNet: w.forecastNet, forecastMembers: w.forecastMembers, averageDays: w.averageDays,
    months: monthly(rows, today, 5).map((m) => ({ month: m.month, label: m.label, joined: m.joined, left: m.left, net: m.net, membersAtEnd: m.membersAtEnd })),
  });
}
