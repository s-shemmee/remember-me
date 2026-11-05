import { createBrowserClient } from "@supabase/ssr";

import { getEnv } from "@/lib/env";

import type { Database } from "./types";

/**
 * Supabase in Client Components, acting as the signed-in user (RLS applies).
 * Publishable key only. createBrowserClient reuses one instance per tab.
 */
export function createSupabaseBrowserClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = getEnv();
  return createBrowserClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
