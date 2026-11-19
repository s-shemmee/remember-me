/**
 * Where `pnpm seed:demo` may write (docs/decisions.md, docs/launch.md).
 *
 * Allowed: local Supabase (127.0.0.1 / localhost), or the staging project
 * named explicitly in SUPABASE_STAGING_REF. Everything else is refused before
 * anything is written: a missing or malformed URL, any other project (so
 * production, whose ref is never configured here), any other host. On staging
 * the demo password must be given (SEED_DEMO_PASSWORD), never the local one.
 *
 * Pure (no imports), so scripts run it with Node and Vitest tests it.
 */
export type SeedTarget =
  | { ok: true; kind: "local" | "staging"; url: string; ref: string | null }
  | { ok: false; reason: string };

const REF = /^[a-z]{20}$/;

export function checkSeedTarget(input: {
  url: string | undefined;
  stagingRef: string | undefined;
  password?: string | undefined;
}): SeedTarget {
  const raw = input.url?.trim();
  if (!raw) {
    return {
      ok: false,
      reason:
        "No Supabase URL. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL in .env.local) to local Supabase or the staging project.",
    };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "The Supabase URL isn't a valid URL." };
  }

  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, reason: "The local Supabase URL must be http(s)." };
    }
    return { ok: true, kind: "local", url: url.origin, ref: null };
  }

  const match = /^([a-z]{20})\.supabase\.co$/.exec(url.hostname);
  if (url.protocol !== "https:" || !match) {
    return {
      ok: false,
      reason: `Refusing ${url.hostname}: seed:demo only runs against local Supabase or the staging project.`,
    };
  }
  const ref = match[1]!;
  const staging = input.stagingRef?.trim();
  if (!staging || !REF.test(staging)) {
    return {
      ok: false,
      reason:
        "Refusing a cloud project: SUPABASE_STAGING_REF isn't set. Name the staging project explicitly to seed it.",
    };
  }
  if (ref !== staging) {
    return {
      ok: false,
      reason:
        "Refusing: that project isn't the staging project in SUPABASE_STAGING_REF (production is never seeded).",
    };
  }
  if (!input.password || input.password.length < 12) {
    return {
      ok: false,
      reason: "On staging, set SEED_DEMO_PASSWORD (12+ characters) for the demo accounts.",
    };
  }
  return { ok: true, kind: "staging", url: url.origin, ref };
}

/** The demo address for one account, from a pattern with "{name}" in it. */
export function demoEmail(pattern: string, name: string): string {
  if (!pattern.includes("{name}")) throw new Error('SEED_DEMO_EMAIL must contain "{name}".');
  return pattern.replace("{name}", name.toLowerCase());
}
