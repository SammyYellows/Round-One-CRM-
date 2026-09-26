// Supabase connection settings. The URL and publishable key are safe in the
// browser (row-level security blocks everything for them); the secret key is
// read only in src/lib/server/.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** False on a machine without .env.local: the prototype then runs without login. */
export const supabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
