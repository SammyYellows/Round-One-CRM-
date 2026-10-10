import { NextResponse } from "next/server";
import { safeNext } from "@/lib/supabase/next";
import { authClient } from "@/lib/supabase/server";
import { rememberEmail } from "@/lib/server/lastEmail";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));
  const { error } = await authClient().auth.signInWithPassword({ email, password });
  const to = error ? `/login?error=login&next=${encodeURIComponent(next)}` : next;
  return rememberEmail(NextResponse.redirect(new URL(to, req.url), { status: 303 }), email);
}
