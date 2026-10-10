// The inactivity threshold (days without a session before the coach is told).

import { DEFAULT_INACTIVE_DAYS, inactiveDays } from "@/lib/server/activity";
import { requireManager, requireStaff } from "@/lib/server/staff";
import { db } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  return Response.json({ days: await inactiveDays(), defaultDays: DEFAULT_INACTIVE_DAYS });
}

export async function PUT(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as { days?: unknown };
  const n = Math.round(Number(b.days));
  if (!Number.isFinite(n) || n < 3 || n > 365) return Response.json({ error: "Between 3 and 365 days" }, { status: 400 });
  await db().from("settings").upsert({ id: "inactivity", value: { days: n }, updated_at: new Date().toISOString() });
  return Response.json({ ok: true, days: n });
}
