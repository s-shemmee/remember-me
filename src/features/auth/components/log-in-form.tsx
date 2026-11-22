"use client";

import Link from "next/link";
import type * as React from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { SocialButton } from "@/components/ui/social-button";

import { logIn, logInWithGoogle, resendFromLogIn } from "../actions";
import { AUTH_MESSAGES, LINK_ERRORS } from "../messages";
import type { AuthFormState } from "../state";
import { ConsentNote } from "./consent-note";
import { AuthSwitch, FormMessage, OrDivider } from "./auth-shell";
import { ResendForm } from "./resend-form";

type Fields = "email" | "password";

/** After "Delete my account": a gentle goodbye. */
export function DeletedNote() {
  return (
    <p role="status" className="rounded-[20px] bg-card2 px-4 py-3 text-15">
      Your account and everything in it are deleted. Take care 💛
    </p>
  );
}

/**
 * The log-in form. It's in the page's static shell and never swapped out, so
 * nothing typed or autofilled is lost. What depends on the URL (?next=,
 * ?error=, ?deleted=) streams in through the slots.
 */
export function LogInForm({
  next,
  error,
  deleted = false,
  topNotice,
  hiddenNext,
  linkNotice,
}: {
  next?: string;
  error?: string;
  /** After "Delete my account": a gentle goodbye. */
  deleted?: boolean;
  /** Streamed: the goodbye note after deleting an account. */
  topNotice?: React.ReactNode;
  /** Streamed: `<input type="hidden" name="next">` (rendered in both forms). */
  hiddenNext?: React.ReactNode;
  /** Streamed: a failed email link or Google sign-in. */
  linkNotice?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState<AuthFormState<Fields>, FormData>(logIn, {});
  const linkError = error ? LINK_ERRORS[error] : undefined;

  // Blocks are direct children of AuthShell's 22px column, as in the screens.
  return (
    <>
      {deleted && <DeletedNote />}
      {topNotice}
      <form action={logInWithGoogle}>
        {next && <input type="hidden" name="next" value={next} />}
        {hiddenNext}
        <SocialButton provider="google" />
      </form>

      <OrDivider />

      <form action={action} noValidate className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        {hiddenNext}
        <Field
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
        />
        <PasswordField
          name="password"
          autoComplete="current-password"
          placeholder="Your password"
          required
          error={state.fieldErrors?.password}
          labelAside={
            <Link
              href="/forgot-password"
              className="inline-flex min-h-11 items-center text-14 font-semibold text-accent-text underline-offset-2 hover:underline"
            >
              Forgot password?
            </Link>
          }
        />

        <FormMessage error={state.formError ?? linkError} />
        {!state.formError && linkNotice}
        {state.kind === "badLogin" && (
          <div className="grid gap-1 text-15">
            <p className="flex flex-wrap gap-x-4">
              <Link
                href="/forgot-password"
                className="inline-flex min-h-11 items-center font-semibold text-accent-text underline underline-offset-2"
              >
                Forgot password?
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex min-h-11 items-center font-semibold text-accent-text underline underline-offset-2"
              >
                Sign up
              </Link>
            </p>
            <p className="text-14 text-sub">{AUTH_MESSAGES.googleHint}</p>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" aria-disabled={pending || undefined}>
          {pending ? "Logging you in…" : "Log in"}
        </Button>
      </form>

      {state.kind === "notConfirmed" && (
        <ResendForm
          action={resendFromLogIn}
          email={state.values?.email ?? ""}
          label="Resend the confirmation link"
        />
      )}

      <AuthSwitch question="New here?" href="/sign-up">
        Create a free account
      </AuthSwitch>
      <ConsentNote />
    </>
  );
}
