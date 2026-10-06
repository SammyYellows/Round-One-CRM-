// How many enquiries are waiting for a reply, for the sidebar badge.

import { db } from "@/lib/server/supabase";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  // ?since=<iso>: only enquiries that arrived after the staff member last opened the screen.
  const since = new URL(req.url).searchParams.get("since");
  let q = db().from("enquiries").select("id", { count: "exact", head: true }).neq("kind", "other").in("status", ["new", "drafted"]);
  if (since && !Number.isNaN(Date.parse(since))) q = q.gt("received_at", new Date(since).toISOString());
  const { count } = await q;
  return Response.json({ open: count ?? 0 });
}
