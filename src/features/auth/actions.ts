"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { requestAccountNotice } from "@/lib/account-notice";
import { EMAIL_NOT_SENT, isEmailSendFailure, reportAuthError } from "@/lib/auth-errors";
import { siteOrigin } from "@/lib/site-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPushEndpoint } from "@/features/reminders/push";

import { onboardingRedirect } from "@/features/onboarding/redirect";

import { AUTH_MESSAGES as MESSAGES, RESEND_COOLDOWN_SECONDS } from "./messages";
import { HOME_PATH, safeNextPath } from "./redirects";
import { forgotPasswordSchema, logInSchema, resetPasswordSchema, signUpSchema } from "./schemas";
import { type AuthFormState, fieldErrorsFrom } from "./state";

/**
 * Auth Server Actions. Each one validates with Zod, talks to Supabase as the
 * visitor (publishable key, cookies) and returns a typed AuthFormState, or
 * redirects on success. Rate limits come from Supabase Auth for now.
 *
 * Privacy: messages never reveal whether an email has an account (every
 * case is listed in docs/decisions.md). Unexpected errors go to Sentry with
 * the Supabase code and status only (reportAuthError), never the email
 * address or password.
 */

const PENDING_EMAIL_COOKIE = "rm-pending-email";
/** When a Resend button last sent (ms), for its 60-second cooldown. */
const RESEND_AT_COOKIE = "rm-resend-at";

/** The cooldown: null when Resend may send now, else when it may send again (ms). */
async function resendCooldown(): Promise<number | null> {
  const at = Number((await cookies()).get(RESEND_AT_COOKIE)?.value);
  const until = at + RESEND_COOLDOWN_SECONDS * 1000;
  return Number.isFinite(at) && until > Date.now() ? until : null;
}

async function startResendCooldown(): Promise<number> {
  const now = Date.now();
  (await cookies()).set(RESEND_AT_COOKIE, String(now), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: RESEND_COOLDOWN_SECONDS,
  });
  return now + RESEND_COOLDOWN_SECONDS * 1000;
}

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

function isRateLimit(code: string | undefined, status: number | undefined) {
  return status === 429 || (code?.startsWith("over_") ?? false);
}

export async function signUp(
  _prev: AuthFormState<"firstName" | "email" | "password">,
  formData: FormData,
): Promise<AuthFormState<"firstName" | "email" | "password">> {
  const input = {
    firstName: str(formData, "firstName"),
    email: str(formData, "email"),
    password: str(formData, "password"),
  };
  const values = { firstName: input.firstName, email: input.email };
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { first_name: parsed.data.firstName },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
    },
  });

  if (error) {
    if (isRateLimit(error.code, error.status)) return { formError: MESSAGES.tooMany, values };
    if (error.code === "weak_password") {
      return { fieldErrors: { password: MESSAGES.weakPassword }, values };
    }
    if (error.code === "email_address_invalid") {
      return { fieldErrors: { email: "That email doesn't look right." }, values };
    }
    if (isEmailSendFailure(error)) {
      reportAuthError("sign_up", error);
      return { formError: EMAIL_NOT_SENT, values };
    }
    // An existing account is not an error here (Supabase hides it with a
    // user that has no identities, or says user_already_exists): the same
    // "Check your email" screen either way.
    if (error.code !== "user_already_exists") {
      reportAuthError("sign_up", error);
      return { formError: MESSAGES.generic, values };
    }
  }

  if (data?.session) redirect(HOME_PATH); // Only when confirmation is off.

  // For EVERY sign-up, after the response is sent (so its timing can't hint
  // either way): account-notice emails "You already have an account" only if
  // the address has a confirmed account. An unconfirmed one gets its
  // confirmation link again from Supabase itself.
  const email = parsed.data.email;
  after(() => requestAccountNotice(email));

  (await cookies()).set(PENDING_EMAIL_COOKIE, parsed.data.email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 30,
  });
  redirect("/check-email");
}

export async function logIn(
  _prev: AuthFormState<"email" | "password">,
  formData: FormData,
): Promise<AuthFormState<"email" | "password">> {
  const input = { email: str(formData, "email"), password: str(formData, "password") };
  const values = { email: input.email };
  const parsed = logInSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (isRateLimit(error.code, error.status)) return { formError: MESSAGES.tooMany, values };
    if (error.code === "email_not_confirmed") {
      return { formError: MESSAGES.notConfirmed, kind: "notConfirmed", values };
    }
    // A wrong password and an unknown email look exactly the same.
    if (error.code === "invalid_credentials" || error.status === 400) {
      return { formError: MESSAGES.badLogin, kind: "badLogin", values };
    }
    reportAuthError("log_in", error);
    return { formError: MESSAGES.generic, values };
  }

  // Straight to onboarding if it isn't finished (no stop at /home first).
  const next = safeNextPath(str(formData, "next"));
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", data.user.id)
    .maybeSingle();
  redirect(onboardingRedirect(next, Boolean(profile?.onboarded_at)) ?? next);
}

export async function logInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNextPath(str(formData, "next"));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) {
    reportAuthError("google_start", error ?? { code: "no_url" });
    redirect("/log-in?error=google");
  }
  redirect(data.url);
}

export async function requestPasswordReset(
  _prev: AuthFormState<"email">,
  formData: FormData,
): Promise<AuthFormState<"email">> {
  const input = { email: str(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values: input };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/confirm`,
  });
  if (error && isRateLimit(error.code, error.status)) {
    return { formError: MESSAGES.tooMany, values: input };
  }
  // Worth knowing about (the email may not have gone out), but never shown.
  if (error && error.code !== "user_not_found") reportAuthError("reset_password", error);
  // Same answer whether or not the account exists, and for any other error.
  return { notice: MESSAGES.resetSent };
}

export async function updatePassword(
  _prev: AuthFormState<"password">,
  formData: FormData,
): Promise<AuthFormState<"password">> {
  const parsed = resetPasswordSchema.safeParse({ password: str(formData, "password") });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { formError: MESSAGES.linkExpired };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { fieldErrors: { password: MESSAGES.samePassword } };
    if (error.code === "weak_password") return { fieldErrors: { password: MESSAGES.weakPassword } };
    if (isRateLimit(error.code, error.status)) return { formError: MESSAGES.tooMany };
    reportAuthError("update_password", error);
    return { formError: MESSAGES.generic };
  }
  redirect(HOME_PATH);
}

/**
 * "Send it again": a fresh confirmation link if the account isn't confirmed
 * yet, or the "You already have an account" email if it is (account-notice).
 * The same answer either way, at most once a minute (cookie, plus Supabase's
 * own limit).
 */
async function resendFor(email: string, action: string): Promise<AuthFormState> {
  const waitUntil = await resendCooldown();
  if (waitUntil) return { formError: MESSAGES.resendWait, cooldownUntil: waitUntil };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  });
  if (error && isRateLimit(error.code, error.status)) return { formError: MESSAGES.tooMany };
  if (error && isEmailSendFailure(error)) {
    reportAuthError(action, error);
    return { formError: EMAIL_NOT_SENT };
  }
  // An already-confirmed (or unknown) address: Supabase sends nothing, and
  // that's expected, so it isn't reported.
  if (error && !/confirm|not.?found|invalid/i.test(`${error.code} ${error.message}`)) {
    reportAuthError(action, error);
  }
  after(() => requestAccountNotice(email));
  return { notice: MESSAGES.resent, cooldownUntil: await startResendCooldown() };
}

/** "Check your email" → Send it again (the address from sign-up, in a cookie). */
export async function resendConfirmation(
  _prev: AuthFormState,
  _formData: FormData,
): Promise<AuthFormState> {
  const email = (await cookies()).get(PENDING_EMAIL_COOKIE)?.value;
  if (!email) return { formError: MESSAGES.resendNeedsEmail };
  return resendFor(email, "resend_confirmation");
}

/** Log in → "Please confirm your email first" → Resend (the typed address). */
export async function resendFromLogIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: str(formData, "email") });
  if (!parsed.success) return { formError: MESSAGES.resendNeedsEmail };
  return resendFor(parsed.data.email, "resend_from_log_in");
}

/**
 * Logs out. With this device's push endpoint, its subscription is removed
 * first (RLS: only your own), so a shared device stops getting your reminders.
 */
export async function logOut(pushEndpoint?: unknown): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (typeof pushEndpoint === "string" && isPushEndpoint(pushEndpoint)) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", pushEndpoint);
  }
  await supabase.auth.signOut();
  redirect("/log-in");
}
