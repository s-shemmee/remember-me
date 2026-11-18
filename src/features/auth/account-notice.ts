/**
 * The account-notice Edge Function's rules, pure so they're unit-tested and
 * shared with Deno (imports end in `.ts`; Web Crypto only).
 *
 * - Only our Next server may call it: `Authorization: Bearer
 *   <ACCOUNT_NOTICE_SECRET>`, compared in constant time. Anything else: 401.
 * - The address is logged as HMAC-SHA-256(EMAIL_HASH_SECRET, lower(trim(email))),
 *   never in plain text.
 */

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** True only for `Bearer <secret>` with the exact secret (and a real secret set). */
export function isNoticeCaller(authorization: string | null, secret: string): boolean {
  if (secret.length < 32) return false;
  const header = authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && safeEqual(token, secret);
}

/** A plausible address (the database decides whether it has an account). */
export function noticeEmail(body: unknown): string | null {
  const email =
    typeof body === "object" && body !== null && "email" in body
      ? (body as { email: unknown }).email
      : null;
  if (typeof email !== "string") return null;
  const trimmed = email.trim();
  return trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/** HMAC-SHA-256 of the normalised address, as Postgres bytea hex ("\x…"). */
export async function emailHash(secret: string, email: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(email.trim().toLowerCase()),
  );
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `\\x${hex}`;
}
