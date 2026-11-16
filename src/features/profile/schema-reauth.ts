/** Pure, no imports: shared with the delete-account Edge Function (Deno). */

/**
 * Re-authentication for sensitive changes: a password for email accounts;
 * for Google-only accounts, a sign-in within the last 10 minutes (the
 * token's `amr` timestamps).
 */
export const REAUTH_WINDOW_SECONDS = 10 * 60;

export function signedInRecently(
  amr: unknown,
  nowSeconds: number,
  windowSeconds = REAUTH_WINDOW_SECONDS,
): boolean {
  if (!Array.isArray(amr)) return false;
  const latest = Math.max(
    0,
    ...amr.map((a) =>
      typeof a === "object" && a && typeof (a as { timestamp?: unknown }).timestamp === "number"
        ? (a as { timestamp: number }).timestamp
        : 0,
    ),
  );
  return latest > 0 && nowSeconds - latest <= windowSeconds;
}
