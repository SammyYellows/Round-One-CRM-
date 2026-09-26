// Who is signed in, and are they staff? Server-only.

import type { User } from "@supabase/supabase-js";
import { authClient } from "@/lib/supabase/server";
import { db } from "./supabase";

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
