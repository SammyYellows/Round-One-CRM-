// Who's in the gym now, with their waiver and emergency contact (safety.ts).
// Staff only. GET reads TeamUp (classes on now) and Kisi (door entries),
// cached for two minutes. POST ticks off someone who isn't a CRM contact
// (contacts are ticked with the markSafetyChecked action).

import { MAX_WINDOW_HOURS, ackUnknown, whoIsIn } from "@/lib/server/safety";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const hours = Number(new URL(req.url).searchParams.get("hours")) || MAX_WINDOW_HOURS;
  try {
    return Response.json(await whoIsIn(hours));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as { key?: unknown };
  const key = typeof b.key === "string" ? b.key.slice(0, 200) : "";
  if (!/^(tu|k):/.test(key)) return Response.json({ error: "Not a TeamUp or Kisi key" }, { status: 400 });
  await ackUnknown(key);
  return Response.json({ ok: true });
}
