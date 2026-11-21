"use client";

import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";

import { type UnsubscribeState, unsubscribeEmail } from "../unsubscribe-action";

const COPY = {
  idle: {
    title: "Stop reminder emails?",
    body: "You won't get reminder emails from Noor any more. Everything else stays as it is, and you can turn them back on in Settings.",
  },
  done: {
    title: "Done. No more reminder emails",
    body: "You can turn them back on in Settings anytime. I'll still be here 🕯️",
  },
  invalid: {
    title: "This link doesn't work",
    body: "It may be incomplete. You can turn reminder emails off in Settings instead.",
  },
  error: {
    title: "Stop reminder emails?",
    body: "Something went wrong on our side. Please try again in a minute.",
  },
} as const;

/** One button, so mail scanners that open links never unsubscribe anyone. */
export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = React.useActionState<UnsubscribeState, FormData>(
    unsubscribeEmail,
    { status: token ? "idle" : "invalid" },
  );
  const heading = React.useRef<HTMLHeadingElement>(null);
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [state.status]);

  const copy = COPY[state.status];
  return (
    <>
      <div className="flex flex-col gap-2.5">
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-34 leading-[1.1] font-extrabold tracking-heading outline-none sm:text-44"
        >
          {copy.title}
        </h1>
        <p
          role={state.status === "error" ? "alert" : undefined}
          className="text-17 leading-[1.55] text-sub"
        >
          {copy.body}
        </p>
      </div>
      {state.status === "idle" || state.status === "error" ? (
        <form action={action}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Unsubscribing…" : "Unsubscribe"}
          </Button>
        </form>
      ) : (
        <Button asChild variant="card2" className="w-fit">
          <Link href="/settings/reminders">Open Settings</Link>
        </Button>
      )}
    </>
  );
}
