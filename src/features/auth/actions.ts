"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { siteOrigin } from "@/lib/site-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPushEndpoint } from "@/features/reminders/push";

import { onboardingRedirect } from "@/features/onboarding/redirect";

import { HOME_PATH, safeNextPath } from "./redirects";
import { forgotPasswordSchema, logInSchema, resetPasswordSchema, signUpSchema } from "./schemas";
import { type AuthFormState, fieldErrorsFrom } from "./state";

/**
 * Auth Server Actions. Each one validates with Zod, talks to Supabase as the
 * visitor (publishable key, cookies) and returns a typed AuthFormState, or
 * redirects on success. Rate limits come from Supabase Auth for now.
 *
 * Privacy: messages never reveal whether an email has an account.
 */

const PENDING_EMAIL_COOKIE = "rm-pending-email";

const MESSAGES = {
  tooMany: "Too many tries for now. Please wait a minute and try again.",
  generic: "Something went wrong on our side. Please try again.",
  badLogin: "That email and password don't match. Try again, or reset your password.",
  notConfirmed: "Please confirm your email first. Check your inbox for our link.",
  samePassword: "That's your current password. Choose a new one.",
  weakPassword: "That password is too easy to guess. Try a longer one.",
  linkExpired: "This link has expired. Ask for a new one below.",
  resetSent: "If there's an account for that email, we've sent a link to reset your password.",
  resent: "Sent again. It can take a minute to arrive.",
} as const;

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
    // An existing account is not an error here: Supabase hides it when email
    // confirmation is on, and so do we (same "check your email" page).
    if (error.code !== "user_already_exists") return { formError: MESSAGES.generic, values };
  }

  if (data.session) redirect(HOME_PATH); // Only when confirmation is off.

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
    if (error.code === "email_not_confirmed") return { formError: MESSAGES.notConfirmed, values };
    if (error.code === "invalid_credentials" || error.status === 400) {
      return { formError: MESSAGES.badLogin, values };
    }
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
  if (error || !data.url) redirect("/log-in?error=google");
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
    return { formError: MESSAGES.generic };
  }
  redirect(HOME_PATH);
}

export async function resendConfirmation(
  _prev: AuthFormState,
  _formData: FormData,
): Promise<AuthFormState> {
  const email = (await cookies()).get(PENDING_EMAIL_COOKIE)?.value;
  if (!email) return { formError: "Please sign up again so we know where to send it." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  });
  if (error && isRateLimit(error.code, error.status)) return { formError: MESSAGES.tooMany };
  return { notice: MESSAGES.resent };
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
