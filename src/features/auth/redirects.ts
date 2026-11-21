/** Where people land after signing in, until onboarding exists (M1 part 2). */
export const HOME_PATH = "/home";

/**
 * Only same-site paths are allowed as a `next` redirect, so links like
 * /log-in?next=https://evil.example can't send people elsewhere.
 */
export function safeNextPath(next: string | null | undefined, fallback = HOME_PATH): string {
  if (!next) return fallback;
  // One leading slash, then not a second slash or backslash ("//evil", "/\evil").
  if (!/^\/(?![/\\])/.test(next)) return fallback;
  // No control characters (tabs and newlines can smuggle "//" past checks).
  if (/[\u0000-\u001F\u007F]/.test(next)) return fallback;
  try {
    // Resolving against a dummy origin must stay on that origin.
    const url = new URL(next, "http://same.site");
    if (url.origin !== "http://same.site") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Pages only signed-in people may see. Grows with the app (M1 part 2, M2…). */
export const PROTECTED_PREFIXES = [
  "/home",
  "/onboarding",
  "/people",
  "/calendar",
  "/wishlists",
  "/celebrate",
  "/profile",
  "/settings",
  "/help-and-feedback",
] as const;

/**
 * /help is two pages: the public help center for visitors, and Help &
 * feedback (Ask Noor, topics, Send feedback) inside the app for signed-in
 * people, at the same address. Articles (/help/<slug>) stay public for all.
 */
export const IN_APP_HELP_PATH = "/help-and-feedback";

/** Pages signed-in people skip (they go home instead): the landing page too. */
export const GUEST_ONLY_PATHS = ["/", "/log-in", "/sign-up"] as const;

const matchesPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export type RouteDecision =
  { action: "continue" } | { action: "redirect"; to: string } | { action: "rewrite"; to: string };

/** What the proxy should do for a request, given whether someone is signed in. */
export function decideRoute(pathname: string, search: string, signedIn: boolean): RouteDecision {
  // An auth email link whose redirect fell back to the Site URL (no allowed
  // redirect_to): "/?token_hash=…&type=…" is meant for /auth/confirm.
  if (pathname === "/" && new URLSearchParams(search).has("token_hash")) {
    return { action: "redirect", to: `/auth/confirm${search}` };
  }
  if (!signedIn && PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    const next = `${pathname}${search}`;
    return { action: "redirect", to: `/log-in?next=${encodeURIComponent(next)}` };
  }
  if (signedIn && GUEST_ONLY_PATHS.some((p) => matchesPrefix(pathname, p))) {
    return { action: "redirect", to: HOME_PATH };
  }
  if (signedIn && (pathname === "/help" || pathname === "/help/")) {
    return { action: "rewrite", to: `${IN_APP_HELP_PATH}${search}` };
  }
  return { action: "continue" };
}
