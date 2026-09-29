// Supabase client with the SECRET key. It bypasses row-level security, so it
// must only ever run on the server: never import this from a "use client"
// file or anything a client file imports.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";

if (typeof window !== "undefined") {
  throw new Error("src/lib/server/supabase.ts was imported in the browser. Keep it server-side.");
}

let client: SupabaseClient | null = null;

/**
 * fetch for the database client. Never cached (Next.js caches fetch() in
 * server pages by default; the CRM must always read the latest). And when
 * Supabase refuses a request with "JWT issued at future" (a small clock
 * difference on Supabase's side, seen on the 5-minute scheduler runs), it
 * waits a second and tries again, up to twice.
 */
async function freshFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(input, { ...init, cache: "no-store" });
    if (res.status !== 401 || attempt >= 2) return res;
    const body = await res.clone().text();
    if (!body.includes("JWT issued at future")) return res;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

export function db(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !key) throw new Error("Supabase isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  client ??= createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: freshFetch },
  });
  return client;
}
