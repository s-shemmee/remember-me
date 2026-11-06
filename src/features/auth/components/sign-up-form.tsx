"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { SocialButton } from "@/components/ui/social-button";

import { logInWithGoogle, signUp } from "../actions";
import { PASSWORD_MIN } from "../schemas";
import type { AuthFormState } from "../state";
import { FormMessage, OrDivider } from "./auth-shell";

type Fields = "firstName" | "email" | "password";

export function SignUpForm() {
  const [state, action, pending] = useActionState<AuthFormState<Fields>, FormData>(signUp, {});

  return (
    <div className="grid gap-6">
      <form action={logInWithGoogle}>
        <SocialButton provider="google" />
      </form>

      <OrDivider />

      <form action={action} noValidate className="grid gap-5">
        <Field
          label="What should we call you?"
          name="firstName"
          autoComplete="given-name"
          placeholder="Your first name"
          required
          maxLength={50}
          defaultValue={state.values?.firstName}
          error={state.fieldErrors?.firstName}
        />
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
          autoComplete="new-password"
          placeholder={`At least ${PASSWORD_MIN} characters`}
          required
          minLength={PASSWORD_MIN}
          error={state.fieldErrors?.password}
        />

        <FormMessage error={state.formError} />

        <Button type="submit" size="lg" className="w-full" aria-disabled={pending || undefined}>
          {pending ? "Creating your account…" : "Create my account"}
        </Button>

        <p className="text-13 text-sub">
          By continuing you agree to our{" "}
          <Link href="/terms" className="font-semibold text-text underline underline-offset-2">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold text-text underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <p className="text-15 text-sub">
        Already have an account?{" "}
        <Link
          href="/log-in"
          className="inline-flex min-h-11 items-center font-semibold text-accent-text underline-offset-2 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
