"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";

import { requestPasswordReset, resendConfirmation, updatePassword } from "../actions";
import { PASSWORD_MIN } from "../schemas";
import type { AuthFormState } from "../state";
import { FormMessage } from "./auth-shell";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState<"email">, FormData>(
    requestPasswordReset,
    {},
  );

  return (
    <form action={action} noValidate className="grid gap-5">
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
      <FormMessage error={state.formError} notice={state.notice} />
      <Button type="submit" size="lg" className="w-full" aria-disabled={pending || undefined}>
        {pending ? "Sending…" : "Send me a link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState<"password">, FormData>(
    updatePassword,
    {},
  );

  return (
    <form action={action} noValidate className="grid gap-5">
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        placeholder={`At least ${PASSWORD_MIN} characters`}
        required
        minLength={PASSWORD_MIN}
        error={state.fieldErrors?.password}
      />
      <FormMessage error={state.formError} />
      <Button type="submit" size="lg" className="w-full" aria-disabled={pending || undefined}>
        {pending ? "Saving…" : "Save my new password"}
      </Button>
    </form>
  );
}

export function ResendConfirmationForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(resendConfirmation, {});

  return (
    <form action={action} className="grid gap-4">
      <FormMessage error={state.formError} notice={state.notice} />
      <Button type="submit" variant="card2" className="w-full" aria-disabled={pending || undefined}>
        {pending ? "Sending…" : "Send the link again"}
      </Button>
    </form>
  );
}
