// Supabase client for the staff login session, used in server components and
// route handlers. It carries the signed-in staff member's session in cookies
// and uses the publishable key, so it can only do what Supabase Auth allows.
// For reading or writing CRM data, use src/lib/server/supabase.ts instead.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

export function authClient() {
  const store = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server components can't set cookies; middleware refreshes the session instead.
        }
      },
    },
  });
}
