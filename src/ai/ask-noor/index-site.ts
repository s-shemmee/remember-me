/**
 * Which site `pnpm ai:index` reads the FAQ, /privacy and /terms from. It must
 * match the Supabase project being indexed: the production site for the
 * cloud project, localhost only for local Supabase. Pure (no imports): used
 * by scripts/ai-index.ts and Vitest.
 *
 * Order: `--site=<url>` (or `--site <url>`), then SITE_URL, then the default
 * for the target. Never NEXT_PUBLIC_SITE_URL: in .env.local it is localhost,
 * which is how production got indexed from a local dev server.
 */
export const PRODUCTION_SITE = "https://rememberme.shemme.codes";
export const LOCAL_SITE = "http://localhost:3000";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"]);

export function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return LOCAL_HOSTS.has(host) || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

/** `--site=<url>` or `--site <url>`, if given. */
export function siteFlag(argv: readonly string[]): string | undefined {
  const i = argv.findIndex((a) => a === "--site" || a.startsWith("--site="));
  if (i === -1) return undefined;
  const arg = argv[i] ?? "";
  return arg === "--site" ? (argv[i + 1] ?? "") : arg.slice("--site=".length);
}

export type IndexSite = { ok: true; site: string } | { ok: false; error: string };

export function indexSite(args: {
  /** From --site. */
  flag?: string;
  /** SITE_URL from the environment. */
  siteUrl?: string;
  /** The Supabase project being indexed (empty for a dry run without one). */
  supabaseUrl?: string;
}): IndexSite {
  const localTarget = Boolean(args.supabaseUrl) && isLocalUrl(args.supabaseUrl ?? "");
  const raw = args.flag ?? (args.siteUrl || (localTarget ? LOCAL_SITE : PRODUCTION_SITE));
  if (!/^https?:\/\/[^/]/.test(raw)) {
    return {
      ok: false,
      error: `the site must be a full URL, like ${PRODUCTION_SITE} (got "${raw}").`,
    };
  }
  const site = raw.replace(/\/+$/, "");
  if (!localTarget && isLocalUrl(site)) {
    return {
      ok: false,
      error:
        `${site} is a local site, but the target is not local Supabase. ` +
        `Use --site=${PRODUCTION_SITE} for the cloud project.`,
    };
  }
  return { ok: true, site };
}
