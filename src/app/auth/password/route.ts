import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/server";

import { isSharedLogin, MIN_PASSWORD } from "@/lib/logins";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const back = (to: string) => NextResponse.redirect(new URL(to, req.url), { status: 303 });
  // Each problem gets its own message (Sammy, 10/10/2026: one message for everything hid the real reason).
  if (password.length < MIN_PASSWORD) return back("/auth/set-password?error=short");
  if (password !== confirm) return back("/auth/set-password?error=match");
  const supabase = authClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return back("/login?error=link");
  // One person changing a shared login's password would lock everyone else out.
  if (isSharedLogin(data.user.email)) return back("/auth/set-password?error=shared");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const code = (error as { code?: string }).code;
    console.error("[auth] password change", code, error.message);
    return back(`/auth/set-password?error=${code === "same_password" ? "same" : code === "weak_password" ? "weak" : "other"}`);
  }
  return back("/auth/set-password?done=1");
}
