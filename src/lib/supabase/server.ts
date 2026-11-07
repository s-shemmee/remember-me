import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { getEnv } from "@/lib/env";

import type { Database } from "./types";

/**
 * Supabase for Server Components, Server Actions and Route Handlers, acting
 * as the signed-in user (session from cookies, RLS applies). Uses the
 * publishable key only. Create one per request; never share it globally.
 */
export async function createSupabaseServerClient() {
  // connection() first: it defers everything below to the real request.
  // cookies() alone isn't enough with partial prefetching (cookies can exist
  // in a prefetch prerender), and Supabase's auth client reads Date.now()
  // while loading the session, which Next flags outside request time. It
  // also keeps the build from reaching the env (no Supabase env in CI).
  await connection();
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = getEnv();

  return createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: the proxy refreshes the session cookie (M1).
          }
        },
      },
    },
  );
}

/**
 * Supabase without a user session (anonymous role, RLS applies), for server
 * code that must not read cookies, such as the health check.
 */
export function createSupabaseAnonServerClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = getEnv();
  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
