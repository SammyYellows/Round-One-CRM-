import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  // Same reply whether or not the account exists, so this can't be used to find staff emails.
  if (email) await authClient().auth.resetPasswordForEmail(email);
  return NextResponse.redirect(new URL("/login?reset=1", req.url), { status: 303 });
}
