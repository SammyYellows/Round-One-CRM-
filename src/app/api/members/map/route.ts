// Active members by postcode area, for the map on Gym members. Counts only.

import { requireStaff } from "@/lib/server/staff";
import { memberMap } from "@/lib/server/memberMap";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  return Response.json(await memberMap());
}
