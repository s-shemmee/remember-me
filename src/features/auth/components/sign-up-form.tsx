"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { SocialButton } from "@/components/ui/social-button";

import { logInWithGoogle, signUp } from "../actions";
import { PASSWORD_MIN } from "../schemas";
import type { AuthFormState } from "../state";
import { AuthSwitch, FormMessage, OrDivider } from "./auth-shell";
import { ConsentNote } from "./consent-note";

type Fields = "firstName" | "email" | "password";

export function SignUpForm() {
  const [state, action, pending] = useActionState<AuthFormState<Fields>, FormData>(signUp, {});

  // Blocks are direct children of AuthShell's 22px column, as in the screens.
  return (
    <>
      <form action={logInWithGoogle}>
        <SocialButton provider="google" />
      </form>

      <OrDivider />

      <form action={action} noValidate className="flex flex-col gap-4">
        <Field
          label="What should we call you?"
          name="firstName"
          autoComplete="given-name"
          placeholder="Your first name"
          required
          maxLength={40}
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
      </form>

      <AuthSwitch question="Already have an account?" href="/log-in">
        Log in
      </AuthSwitch>
      <ConsentNote />
    </>
  );
}
