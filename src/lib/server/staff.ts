// Who is signed in, and are they staff? Server-only.

import type { User } from "@supabase/supabase-js";
import { authClient } from "@/lib/supabase/server";
import { db } from "./supabase";
import { isManagerRole } from "@/lib/roles";

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  email: string | null;
}

export async function currentUser(): Promise<User | null> {
  const { data } = await authClient().auth.getUser();
  return data.user ?? null;
}

/**
 * The staff row for this login. Staff are added by email; the first time
 * they sign in, their login is linked to that row.
 */
export async function staffFor(user: User): Promise<StaffMember | null> {
  const fields = "id, name, role, email";
  const linked = await db().from("staff").select(fields).eq("auth_user_id", user.id).eq("active", true).maybeSingle();
  if (linked.data) return linked.data;
  if (!user.email) return null;
  const byEmail = await db()
    .from("staff")
    .update({ auth_user_id: user.id })
    .ilike("email", user.email)
    .is("auth_user_id", null)
    .eq("active", true)
    .select(fields)
    .maybeSingle();
  return byEmail.data ?? null;
}

/** For API routes: the signed-in staff member, or a ready-made error response. */
export async function requireStaff(): Promise<{ staff: StaffMember } | { error: Response }> {
  const user = await currentUser();
  if (!user) return { error: Response.json({ error: "Not signed in" }, { status: 401 }) };
  const staff = await staffFor(user);
  if (!staff) return { error: Response.json({ error: "Not set up as staff" }, { status: 403 }) };
  return { staff };
}

/** For management-only API routes: Owner or Manager logins only. */
export async function requireManager(): Promise<{ staff: StaffMember } | { error: Response }> {
  const auth = await requireStaff();
  if ("error" in auth) return auth;
  if (!isManagerRole(auth.staff.role)) return { error: Response.json({ error: "Only management can do that" }, { status: 403 }) };
  return auth;
}
