import * as Sentry from "@sentry/nextjs";

import { AUTH_ACTION_TAG } from "./sentry-filters";

/**
 * Unexpected Supabase Auth errors (the ones that end in "Something went
 * wrong on our side"), reported to Sentry with the error code and HTTP status
 * ONLY. Never the error object or its message: Supabase messages can contain
 * the email address ("Email address "…" cannot be used…"), and never
 * anything from the form. `scrubAuthEvent` (in every Sentry config's
 * beforeSend) also drops request data from these events.
 */

/** What we keep of a Supabase AuthError: nothing personal. */
export type AuthErrorLike = { code?: string | null; status?: number | null; message?: string };

export const EMAIL_NOT_SENT =
  "We couldn't send your confirmation email. Please try again in a few minutes.";

/**
 * The confirmation email couldn't go out: the built-in sender refusing an
 * address (`email_address_not_authorized`), or the mail server failing
 * ("Error sending confirmation email", "Error sending email change email").
 */
export function isEmailSendFailure(error: AuthErrorLike): boolean {
  return (
    error.code === "email_address_not_authorized" ||
    /^error sending .*email/i.test(error.message ?? "")
  );
}

/** The Sentry event's parts: a fixed message, the action, the code and status. */
export function authErrorReport(action: string, error: AuthErrorLike) {
  const code = error.code || "unknown";
  return {
    message: `Auth: ${action} failed (${code})`,
    tags: { [AUTH_ACTION_TAG]: action, supabase_code: code },
    context: { status: typeof error.status === "number" ? error.status : null },
    fingerprint: ["auth", action, code],
  };
}

export function reportAuthError(action: string, error: AuthErrorLike): void {
  const report = authErrorReport(action, error);
  Sentry.withScope((scope) => {
    scope.setLevel("error");
    scope.setTags(report.tags);
    scope.setContext("supabase_auth", report.context);
    scope.setFingerprint(report.fingerprint);
    Sentry.captureMessage(report.message);
  });
}
