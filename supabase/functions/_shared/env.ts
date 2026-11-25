import { resolveAppUrl } from "./site-url.ts";

/**
 * Edge Function settings. Secrets (RESEND_API_KEY, UNSUBSCRIBE_SECRET,
 * CRON_SECRET, EMAIL_HASH_SECRET, ACCOUNT_NOTICE_SECRET) live in Supabase
 * function secrets (ACCOUNT_NOTICE_SECRET is also configured on the app server); the Next app and
 * Vercel never see them. The secret key comes from Supabase's own function
 * environment.
 *
 * `supabase/functions/local-dev.env.example` documents local-only values;
 * they're refused anywhere but a local Supabase.
 */

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

const LOCAL_HOSTS = new Set(["kong", "localhost", "127.0.0.1", "host.docker.internal"]);

/** True only for a local Supabase (Docker), never for the cloud project. */
export function isLocal(): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(SUPABASE_URL).hostname);
  } catch {
    return false;
  }
}

/** The project's secret key (new `sb_secret_…` keys first, legacy service role as fallback). */
export function secretKey(): string {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>;
      const first = parsed.default ?? Object.values(parsed)[0];
      if (first) return first;
    } catch {
      // fall through
    }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("No Supabase secret key in the function environment");
  return legacy;
}

export function secret(name: string, minLength = 16): string {
  const value = Deno.env.get(name) ?? "";
  if (value.length < minLength) throw new Error(`${name} is missing or too short`);
  if (value.startsWith("local-only") && !isLocal()) {
    throw new Error(`${name} is a local placeholder; set a real secret for this project`);
  }
  return value;
}

export const cronSecret = () => secret("CRON_SECRET", 16);
export const unsubscribeSecret = () => secret("UNSUBSCRIBE_SECRET", 32);
/** Shared with the Next server only: the one caller account-notice accepts. */
export const accountNoticeSecret = () => secret("ACCOUNT_NOTICE_SECRET", 32);
/** Keys the HMAC of addresses in account_notices (never stored in plain text). */
export const emailHashSecret = () => secret("EMAIL_HASH_SECRET", 32);

/** The site used in email and notification links. Hosted instances must configure it. */
export function appUrl(): string {
  return resolveAppUrl(Deno.env.get("SITE_URL") ?? Deno.env.get("APP_URL"), isLocal());
}

/** Public functions URL for List-Unsubscribe (not SUPABASE_URL, which is internal locally). */
export const functionsUrl = () =>
  (Deno.env.get("PUBLIC_FUNCTIONS_URL") ?? `${SUPABASE_URL}/functions/v1`).replace(/\/+$/, "");

export const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Noor · Remember Me <noor@example.com>";

/**
 * The `now` override for tests: two locks, REMINDERS_ALLOW_NOW=1 AND a local
 * Supabase URL. In the cloud it's ignored even if the variable were set.
 */
export const allowNowOverride = () => Deno.env.get("REMINDERS_ALLOW_NOW") === "1" && isLocal();

/** Constant-time comparison for the cron secret. */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** `Authorization: Bearer <CRON_SECRET>` (pg_cron via pg_net). */
export function isCron(req: Request): boolean {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && safeEqual(token, cronSecret());
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
