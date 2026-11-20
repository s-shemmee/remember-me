"use client";

import { Analytics } from "@vercel/analytics/next";

import { analyticsBeforeSend } from "@/lib/analytics";

/**
 * Vercel Web Analytics: cookieless, anonymous, aggregated page views. Every
 * address is scrubbed first (no tokens, IDs or query strings; src/lib/analytics.ts).
 * Rendered by the root layout only on Vercel, where /_vercel/insights exists.
 */
export function SiteAnalytics() {
  return <Analytics beforeSend={analyticsBeforeSend} />;
}
