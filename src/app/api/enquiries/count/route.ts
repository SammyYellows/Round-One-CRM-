// How many enquiries are waiting for a reply, for the sidebar badge.

import { db } from "@/lib/server/supabase";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { count } = await db().from("enquiries").select("id", { count: "exact", head: true }).neq("kind", "other").in("status", ["new", "drafted"]);
  return Response.json({ open: count ?? 0 });
}
