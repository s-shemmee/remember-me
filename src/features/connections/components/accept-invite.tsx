"use client";

import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";

import { acceptInvite } from "../actions";
import { inviteCopy, type InviteStatus } from "../invite-token";

/**
 * Accept on the invite page. On success, says so and offers the next steps;
 * if the link stopped working meanwhile, shows why.
 */
export function AcceptInvite({
  token,
  inviterName,
}: {
  token: string;
  inviterName: string | null;
}) {
  const [state, setState] = React.useState<
    | { kind: "idle" }
    | { kind: "done" }
    | { kind: "failed"; status: InviteStatus | null; message: string }
  >({ kind: "idle" });
  const [pending, startTransition] = React.useTransition();
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (state.kind !== "idle") headingRef.current?.focus();
  }, [state.kind]);

  if (state.kind === "done") {
    return (
      <div className="grid gap-4">
        <h2 ref={headingRef} tabIndex={-1} className="text-22 font-extrabold outline-none">
          You&apos;re connected with {inviterName ?? "them"} 💛
        </h2>
        <p className="text-15 text-sub">
          You&apos;ll see each other&apos;s shared wishlists as soon as sharing arrives.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/profile">See your connections</Link>
          </Button>
          <Button asChild variant="card2">
            <Link href="/home">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (state.kind === "failed") {
    const copy = state.status ? inviteCopy(state.status, inviterName) : null;
    return (
      <div className="grid gap-3" role="alert">
        <h2 ref={headingRef} tabIndex={-1} className="text-22 font-extrabold outline-none">
          {copy?.title ?? "That didn't work"}
        </h2>
        <p className="text-15 text-sub">{copy?.body ?? state.message}</p>
        <Button asChild variant="card2" className="w-fit">
          <Link href="/home">Go home</Link>
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="lg"
      aria-disabled={pending || undefined}
      onClick={() =>
        startTransition(async () => {
          const result = await acceptInvite(token);
          setState(result.ok ? { kind: "done" } : { kind: "failed", ...result });
        })
      }
      className="w-fit"
    >
      {pending ? "Connecting…" : `Connect with ${inviterName ?? "them"}`}
    </Button>
  );
}
