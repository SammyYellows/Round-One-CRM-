// Remembers the last email typed into the login or reset form (Sammy,
// 10/10/2026: it kept forgetting it), so the next visit fills it in.
// A cookie on this device only; nothing is stored on the server.

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const NAME = "r1_last_email";

export const lastEmail = () => cookies().get(NAME)?.value ?? "";

export function rememberEmail(res: NextResponse, email: string) {
  if (email && email.length < 200) res.cookies.set(NAME, email, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
