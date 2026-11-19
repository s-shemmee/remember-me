import type { MetadataRoute } from "next";

/**
 * Search engines: the landing page is public; everything personal is not.
 * `NO_INDEX` goes on every app, auth, onboarding, invite and unsubscribe
 * route (a test checks), and `PRIVATE_PATHS` are disallowed in robots.txt.
 */
export const NO_INDEX = { index: false, follow: false } as const;

/**
 * Disallowed in robots.txt: the private app. The public auth pages (log in,
 * sign up…) aren't listed on purpose: a disallowed page's `noindex` is never
 * read, so a linked one could still show up as a bare URL. They rely on
 * NO_INDEX instead.
 */
export const PRIVATE_PATHS = [
  "/home",
  "/people",
  "/calendar",
  "/wishlists",
  "/celebrate",
  "/profile",
  "/settings",
  "/help",
  "/onboarding",
  "/invite/",
  "/auth/",
  "/api/",
  "/unsubscribe",
  "/offline",
  "/monitoring",
] as const;

export function robotsFor(siteUrl: string): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}

/** Only public pages: the landing page and the legal pages. */
export function sitemapFor(siteUrl: string): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
