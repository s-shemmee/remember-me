import "server-only";

import { createClient } from "@supabase/supabase-js";

import { REAUTH_WINDOW_SECONDS, signedInRecently } from "@/features/profile/schema";
import { getEnv } from "@/lib/env";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** How you prove it's you: your password, or (Google only) a fresh sign-in. */
export type ReauthMode = "password" | "recent-sign-in";

export const reauthModeFor = (providers: string[]): ReauthMode =>
  providers.includes("email") ? "password" : "recent-sign-in";

export type ReauthResult = "ok" | "wrong-password" | "sign-in-again";

/**
 * Re-authentication for changing your email or deleting your account.
 * Email accounts: the current password, checked with a separate client that
 * keeps no session (its one-off session is revoked straight away).
 * Google-only accounts: a sign-in within the last 10 minutes.
 */
export async function reauthenticate(
  supabase: Supabase,
  password: string | undefined,
): Promise<{ result: ReauthResult; mode: ReauthMode; email: string | null }> {
  const [{ data: userData }, { data: claimsData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
  ]);
  const user = userData?.user;
  const providers = (user?.identities ?? []).map((i) => i.provider);
  const mode = reauthModeFor(providers);
  const email = user?.email ?? null;
  if (!user || !email) return { result: "sign-in-again", mode, email };

  if (mode === "recent-sign-in") {
    const ok = signedInRecently(
      claimsData?.claims?.amr,
      Math.floor(Date.now() / 1000),
      REAUTH_WINDOW_SECONDS,
    );
    return { result: ok ? "ok" : "sign-in-again", mode, email };
  }

  if (!password) return { result: "wrong-password", mode, email };
  const env = getEnv();
  const probe = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return { result: "wrong-password", mode, email };
  await probe.auth.signOut({ scope: "local" });
  return { result: "ok", mode, email };
}
