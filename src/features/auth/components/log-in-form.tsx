"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { SocialButton } from "@/components/ui/social-button";

import { logIn, logInWithGoogle } from "../actions";
import type { AuthFormState } from "../state";
import { AuthSwitch, FormMessage, OrDivider } from "./auth-shell";

type Fields = "email" | "password";

/** Messages for ?error= after a failed email link or Google sign-in. */
const LINK_ERRORS: Record<string, string> = {
  link: "That link has expired or was already used. Log in, or ask for a new one.",
  google: "Google sign-in didn't finish. Please try again.",
};

export function LogInForm({ next, error }: { next?: string; error?: string }) {
  const [state, action, pending] = useActionState<AuthFormState<Fields>, FormData>(logIn, {});
  const linkError = error ? LINK_ERRORS[error] : undefined;

  // Blocks are direct children of AuthShell's 22px column, as in the screens.
  return (
    <>
      <form action={logInWithGoogle}>
        {next && <input type="hidden" name="next" value={next} />}
        <SocialButton provider="google" />
      </form>

      <OrDivider />

      <form action={action} noValidate className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
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

        <Button type="submit" size="lg" className="w-full" aria-disabled={pending || undefined}>
          {pending ? "Logging you in…" : "Log in"}
        </Button>
      </form>

      <AuthSwitch question="New here?" href="/sign-up">
        Create a free account
      </AuthSwitch>
    </>
  );
}
