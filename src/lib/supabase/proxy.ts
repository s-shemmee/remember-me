import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getEnv } from "@/lib/env";

import type { Database } from "./types";

/**
 * Refreshes the Supabase session cookie on every matched request and tells
 * the caller whether someone is signed in. Follows Supabase's SSR guide:
 * create the client, then call getClaims() straight away, nothing in between.
 */
export async function updateSession(request: NextRequest) {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = getEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Cache-busting headers from Supabase so refreshed sessions aren't cached.
          for (const [key, value] of Object.entries(headers ?? {}))
            response.headers.set(key, value);
        },
      },
    },
  );

  // Do not add code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  return { response: () => response, signedIn };
}

/** A redirect that keeps any refreshed session cookies. */
export function redirectWithCookies(request: NextRequest, from: NextResponse, to: string) {
  const redirect = NextResponse.redirect(new URL(to, request.url));
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
