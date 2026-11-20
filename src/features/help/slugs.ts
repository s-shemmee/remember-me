/**
 * The help articles, in reading order. Each slug is a file in docs/help/
 * (`<slug>.md`) and a page at /help/<slug>. Pure: the sitemap imports it.
 */
export const HELP_SLUGS = [
  "getting-started",
  "people-and-days",
  "reminders",
  "wishlists-and-reservations",
  "invites-and-connections",
  "plans-and-celebrate-me",
  "your-data-and-privacy",
  "account-and-settings",
] as const;

export type HelpSlug = (typeof HELP_SLUGS)[number];

export const isHelpSlug = (s: string): s is HelpSlug =>
  (HELP_SLUGS as readonly string[]).includes(s);
