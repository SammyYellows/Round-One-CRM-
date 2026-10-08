// Accountability screen helpers: refresh this week's attendance from TeamUp
// for everyone on the programme (the nightly sync does this too).

import { refreshAttendance } from "@/lib/server/accountability";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  try {
    return Response.json({ ok: true, ...(await refreshAttendance()) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
