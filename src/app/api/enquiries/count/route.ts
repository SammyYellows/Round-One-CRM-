// How many enquiries are waiting for a reply, for the sidebar badge.

import { db } from "@/lib/server/supabase";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  // ?since=<iso>: only enquiries that arrived after the staff member last opened the screen.
  const since = new URL(req.url).searchParams.get("since");
  const base = () => db().from("enquiries").select("id", { count: "exact", head: true }).neq("kind", "other").in("status", ["new", "drafted"]);
  const [{ count: open }, { count: fresh }] = await Promise.all([
    base(),
    since && !Number.isNaN(Date.parse(since)) ? base().gt("received_at", new Date(since).toISOString()) : base(),
  ]);
  // open: everything still waiting for a reply; new: of those, arrived since the staff member last looked.
  return Response.json({ open: open ?? 0, new: fresh ?? 0 });
}
