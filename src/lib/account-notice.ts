import "server-only";

import { z } from "zod";

import { reportAuthError } from "./auth-errors";
import { getEnv } from "./env";

/**
 * Server-only settings (never NEXT_PUBLIC_, never in the browser bundle).
 * ACCOUNT_NOTICE_SECRET is shared with the account-notice Edge Function: it's
 * the only caller the function accepts. Without it, account-exists emails are
 * simply skipped (sign-up still works).
 */
export const serverEnvSchema = z.object({
  ACCOUNT_NOTICE_SECRET: z.string().min(32, { error: "must be at least 32 characters" }).optional(),
});

export function accountNoticeSecret(
  source: Record<string, string | undefined> = process.env,
): string | null {
  const parsed = serverEnvSchema.safeParse({
    ACCOUNT_NOTICE_SECRET: source.ACCOUNT_NOTICE_SECRET || undefined,
  });
  return parsed.success ? (parsed.data.ACCOUNT_NOTICE_SECRET ?? null) : null;
}

/**
 * Asks account-notice to email "You already have an account" to this address.
 * The function decides (a confirmed account, once an hour) and always answers
 * the same, so this reveals nothing. Call it in `after()`, for every sign-up,
 * so the response time doesn't depend on whether the address exists.
 */
export async function requestAccountNotice(email: string): Promise<void> {
  const secret = accountNoticeSecret();
  if (!secret) return;
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = getEnv();
  try {
    const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/account-notice`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        apikey: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok)
      reportAuthError("account_notice", { code: `http_${res.status}`, status: res.status });
  } catch {
    reportAuthError("account_notice", { code: "network" });
  }
}
