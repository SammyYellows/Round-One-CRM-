import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/server";
import { rememberEmail } from "@/lib/server/lastEmail";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  // Same reply whether or not the account exists, so this can't be used to find staff emails.
  if (email) await authClient().auth.resetPasswordForEmail(email);
  // A proper "check your email" screen, not a quiet line on the login page (Sammy, 10/10/2026).
  return rememberEmail(NextResponse.redirect(new URL("/auth/forgot?sent=1", req.url), { status: 303 }), email);
}
