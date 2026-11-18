"use client";

import * as React from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import type { AuthFormState } from "../state";
import { FormMessage } from "./auth-shell";

/**
 * A Resend button (Check your email, and log in when the email isn't
 * confirmed). After a send it rests for a minute: the server enforces it
 * (cookie) and the button says so, then wakes up again on its own.
 */
export function ResendForm({
  action: serverAction,
  email,
  label,
  className,
}: {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  /** Sent with the form (log in: the typed address). */
  email?: string;
  label: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(serverAction, {});
  // No clock in render (the page is prerendered): a send starts the wait,
  // and a timer marks that send's wait as over.
  const [expired, setExpired] = React.useState<number | null>(null);
  const waiting = Boolean(state.cooldownUntil) && expired !== state.cooldownUntil;

  React.useEffect(() => {
    const until = state.cooldownUntil;
    if (!until) return;
    const timer = setTimeout(() => setExpired(until), Math.max(0, until - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [state.cooldownUntil]);

  return (
    <form action={action} className={className ?? "grid gap-3"}>
      {email !== undefined && <input type="hidden" name="email" value={email} />}
      <FormMessage error={state.formError} notice={state.notice} />
      <Button
        type="submit"
        variant="card2"
        // Long labels ("Sent. You can send again in a minute.") wrap on narrow screens.
        className="h-auto min-h-11 w-full py-2.5 text-center whitespace-normal"
        aria-disabled={pending || waiting || undefined}
        onClick={(e) => {
          if (pending || waiting) e.preventDefault();
        }}
      >
        {pending ? "Sending…" : waiting ? "Sent. You can send again in a minute." : label}
      </Button>
    </form>
  );
}
