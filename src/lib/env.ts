import { z } from "zod";

/**
 * Every env var the app reads, validated with Zod.
 *
 * Only browser-safe values live here. The Supabase secret key is for Edge
 * Functions and CI only and must never be read by the Next app
 * (docs/decisions.md). SENTRY_AUTH_TOKEN is read by next.config.ts at build.
 *
 * Validated at server start in src/instrumentation.ts; errors name the
 * variable and the problem, never the value.
 */
export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/, error: "must be an http(s) URL" }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .startsWith("sb_publishable_", { error: 'must be a publishable key ("sb_publishable_…")' }),
  /** The public site, e.g. https://rememberme.shemme.codes (manifest id). Optional locally. */
  NEXT_PUBLIC_SITE_URL: z
    .url({ protocol: /^https?$/, error: "must be an http(s) URL" })
    .transform((url) => url.replace(/\/+$/, ""))
    .optional(),
  /** The VAPID public key (base64url, 65 bytes). Without it, push stays unavailable. */
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z
    .string()
    .regex(/^[A-Za-z0-9_-]{86,88}$/, { error: "must be a base64url VAPID public key" })
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(problems: string[]) {
    super(
      `Invalid environment variables:\n${problems.map((p) => `  - ${p}`).join("\n")}\n` +
        "Check .env.local (see .env.example) or the Vercel project settings.",
    );
    this.name = "EnvError";
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join(".");
    return issue.code === "invalid_type" ? `${name}: missing` : `${name}: ${issue.message}`;
  });
  throw new EnvError(problems);
}

/**
 * Next only inlines NEXT_PUBLIC_* values into the browser bundle when the
 * code names them directly, so read each one by name here.
 */
function readSource() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
  };
}

let cached: Env | undefined;

/** The validated env. Parsed on first use (server start, or first call in the browser). */
export function getEnv(): Env {
  cached ??= parseEnv(readSource());
  return cached;
}

/**
 * The public site URL, or localhost in development. Reads only this one
 * variable (not the whole env), so static files like the manifest can be
 * prerendered at build time, where the Supabase env isn't set.
 */
export function siteUrl(): string {
  const parsed = envSchema.shape.NEXT_PUBLIC_SITE_URL.safeParse(
    process.env.NEXT_PUBLIC_SITE_URL || undefined,
  );
  return (parsed.success ? parsed.data : undefined) ?? "http://localhost:3000";
}
