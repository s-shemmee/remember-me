/**
 * Where `pnpm seed:demo` may write: local Supabase only.
 *
 * There is one cloud project, and it is production (docs/decisions.md,
 * "One Supabase project"), so every cloud URL is refused, whatever it is,
 * before anything is written. Allowed: http(s)://127.0.0.1 or localhost.
 *
 * Pure (no imports), so scripts run it with Node and Vitest tests it.
 */
export type SeedTarget = { ok: true; url: string } | { ok: false; reason: string };

export function checkSeedTarget(rawUrl: string | undefined): SeedTarget {
  const raw = rawUrl?.trim();
  if (!raw) {
    return {
      ok: false,
      reason:
        "No Supabase URL. Start local Supabase (`pnpm db:start`) and point SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL in .env.local) at it, e.g. http://127.0.0.1:54321.",
    };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "The Supabase URL isn't a valid URL." };
  }
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (!local || (url.protocol !== "http:" && url.protocol !== "https:")) {
    return {
      ok: false,
      reason: `Refusing ${url.hostname}: seed:demo only runs against local Supabase. The cloud project is production and is never seeded.`,
    };
  }
  return { ok: true, url: url.origin };
}
