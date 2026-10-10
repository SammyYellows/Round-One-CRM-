// Who's in the gym now, with their waiver and emergency contact (safety.ts).
// Staff only. Live reads of TeamUp (today's classes) and Kisi (door entries).

import { whoIsIn } from "@/lib/server/safety";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const hours = Number(new URL(req.url).searchParams.get("hours")) || 3;
  try {
    return Response.json(await whoIsIn(Math.min(12, Math.max(1, hours))));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
