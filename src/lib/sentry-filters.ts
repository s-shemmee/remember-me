/**
 * Sentry event filters, shared by the client, server and edge configs.
 * Pure (no Sentry import), so they're unit-tested.
 */

/** Tag on reports from src/lib/auth-errors.ts. */
export const AUTH_ACTION_TAG = "auth_action";

type ScrubbableEvent = {
  tags?: Record<string, unknown>;
  request?: { data?: unknown; cookies?: unknown; query_string?: unknown; headers?: unknown };
  user?: unknown;
  extra?: unknown;
};

/** beforeSend: an auth report carries no request body, cookies, query, user or extras. */
export function scrubAuthEvent<E extends ScrubbableEvent>(event: E): E {
  if (!event.tags || !(AUTH_ACTION_TAG in event.tags)) return event;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    delete event.request.headers;
  }
  delete event.user;
  delete event.extra;
  return event;
}

/**
 * Errors from browser extensions aren't ours: drop anything whose stack
 * comes from an extension (Sentry's SDK doesn't filter these by default).
 */
export const EXTENSION_URLS = [
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-(web-)?extension:\/\//i,
];
