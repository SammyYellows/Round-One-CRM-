import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/server";
import { rememberEmail } from "@/lib/server/lastEmail";
import { isSharedLogin, loginEmail } from "@/lib/logins";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  // Shared logins have no inbox: management reset them on the Staff page.
  if (isSharedLogin(loginEmail(email))) return NextResponse.redirect(new URL("/auth/forgot?shared=1", req.url), { status: 303 });
  // Same reply whether or not the account exists, so this can't be used to find staff emails.
  if (email) await authClient().auth.resetPasswordForEmail(email);
  // A proper "check your email" screen, not a quiet line on the login page (Sammy, 10/10/2026).
  return rememberEmail(NextResponse.redirect(new URL("/auth/forgot?sent=1", req.url), { status: 303 }), email);
}
