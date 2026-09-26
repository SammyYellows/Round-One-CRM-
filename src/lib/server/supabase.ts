// Supabase client with the SECRET key. It bypasses row-level security, so it
// must only ever run on the server: never import this from a "use client"
// file or anything a client file imports.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";

if (typeof window !== "undefined") {
  throw new Error("src/lib/server/supabase.ts was imported in the browser. Keep it server-side.");
}

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !key) throw new Error("Supabase isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  client ??= createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
