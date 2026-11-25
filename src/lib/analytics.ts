/**
 * What Vercel Web Analytics may see: the page, never anything that
 * identifies a person, a link or a record.
 *
 * Every page view goes through `scrubAnalyticsUrl` before it leaves the
 * browser (the `beforeSend` of <Analytics>):
 * - the query string and fragment are dropped (invite and reset tokens,
 *   `token_hash`, `type`, `code`, `next`, `?person=<id>`, `?list=…`);
 * - `/invite/<token>` becomes `/invite/[token]`;
 * - a UUID segment becomes `[id]`; any other token-like segment (16+ URL-safe
 *   characters with a digit) becomes `[token]`; anything with an @ becomes `[email]`.
 *
 * Visits from a browser that sends Global Privacy Control or Do Not Track
 * aren't counted at all (the Privacy Policy says so).
 *
 * Unit-tested in src/lib/analytics.test.tsx.
 */
export type AnalyticsEvent = { type: "pageview" | "event"; url: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_LIKE = /^(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{16,}$/;

function scrubSegment(segment: string, previous: string | undefined): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return "[token]";
  }
  if (previous === "invite" && decoded !== "") return "[token]";
  if (UUID.test(decoded)) return "[id]";
  if (decoded.includes("@")) return "[email]";
  if (TOKEN_LIKE.test(decoded)) return "[token]";
  return segment;
}

/** The page's address with nothing that identifies a person, a link or a record. */
export function scrubAnalyticsUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "/";
  }
  const parts = url.pathname.split("/");
  const path = parts.map((s, i) => (s === "" ? s : scrubSegment(s, parts[i - 1]))).join("/");
  return `${url.origin}${path}`;
}

/** Global Privacy Control or Do Not Track: the visitor asked not to be counted. */
export function optedOut(
  nav: { globalPrivacyControl?: boolean; doNotTrack?: string | null } | undefined,
) {
  return nav?.globalPrivacyControl === true || nav?.doNotTrack === "1";
}

/** The `beforeSend` for <Analytics>: same event, scrubbed address; nothing when opted out. */
export function analyticsBeforeSend<E extends AnalyticsEvent>(event: E): E | null {
  const nav =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & { globalPrivacyControl?: boolean });
  if (optedOut(nav)) return null;
  return { ...event, url: scrubAnalyticsUrl(event.url) };
}
