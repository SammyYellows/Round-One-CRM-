import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const back = (to: string) => NextResponse.redirect(new URL(to, req.url), { status: 303 });
  if (password.length < 10 || password !== confirm) return back("/auth/set-password?error=1");
  const supabase = authClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return back("/login?error=link");
  const { error } = await supabase.auth.updateUser({ password });
  // Say it worked before carrying on (Sammy, 10/10/2026: it wasn't obvious).
  return back(error ? "/auth/set-password?error=1" : "/auth/set-password?done=1");
}
