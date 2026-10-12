// A contact's message history copied from GymGrow (gymgrow_messages), for
// the contact page. Read only; any signed-in staff member.

import { requireStaff } from "@/lib/server/staff";
import { db } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { data, error } = await db().from("gymgrow_messages").select("id, channel, dir, subject, body, status, source, at").eq("contact_id", params.id).order("at", { ascending: true }).limit(2000);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ messages: data ?? [] });
}
