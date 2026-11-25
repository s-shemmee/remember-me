/** Selects the site used by the local help-content indexing utility. */
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
  const raw =
    args.flag ?? args.siteUrl ?? (localTarget || !args.supabaseUrl ? LOCAL_SITE : undefined);
  if (!raw) {
    return {
      ok: false,
      error: "Set SITE_URL or pass --site=<url> for the site being indexed.",
    };
  }
  if (!/^https?:\/\/[^/]/.test(raw)) {
    return {
      ok: false,
      error: `the site must be a full URL, such as https://example.com (got "${raw}").`,
    };
  }
  const site = raw.replace(/\/+$/, "");
  if (args.supabaseUrl && !localTarget && isLocalUrl(site)) {
    return {
      ok: false,
      error:
        `${site} is a local site, but the target is not local Supabase. ` +
        "Set SITE_URL or pass --site=<public URL>.",
    };
  }
  return { ok: true, site };
}
