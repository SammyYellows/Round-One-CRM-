// The Members screen's sync status: when each stage last ran and how long
// it took, so a creep towards the 60-second limit is visible.

import { requireStaff } from "@/lib/server/staff";
import { db } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { data } = await db().from("settings").select("value").eq("id", "teamup_sync").maybeSingle();
  return Response.json(data?.value ?? {});
}
