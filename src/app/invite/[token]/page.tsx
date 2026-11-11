import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignUpPanel, signUpPanelClass } from "@/features/auth/components/panels";
import { AcceptInvite } from "@/features/connections/components/accept-invite";
import { inviteCopy, type InviteStatus, isInviteToken } from "@/features/connections/invite-token";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "You're invited · Remember Me",
  // Invite links are private: never indexed, never sent on as a referrer.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const signedIn = Boolean(claims?.claims?.sub);

  let status: InviteStatus = "not_found";
  let name: string | null = null;
  if (isInviteToken(token)) {
    const { data } = await supabase.rpc("invite_preview", { p_token: token });
    const row = data?.[0];
    status = (row?.status as InviteStatus | undefined) ?? "not_found";
    name = row?.inviter_name ?? null;
  }
  const copy = inviteCopy(status, name);

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <h1 className="text-34 leading-[1.1] font-extrabold tracking-heading [overflow-wrap:anywhere] sm:text-44">
          {copy.title}
        </h1>
        <p className="text-17 leading-[1.55] text-sub">{copy.body}</p>
      </div>
      {status === "valid" &&
        (signedIn ? (
          <AcceptInvite token={token} inviterName={name} />
        ) : (
          <div className="grid gap-3">
            <Button asChild size="lg" className="w-fit">
              <a href={`/invite/${token}/start?then=sign-up`}>Create my account</a>
            </Button>
            <p className="text-15 text-sub">
              Already have one?{" "}
              <a
                href={`/invite/${token}/start?then=log-in`}
                className="font-semibold text-accent-text underline-offset-4 hover:underline"
              >
                Log in
              </a>{" "}
              and I&apos;ll bring you back here.
            </p>
          </div>
        ))}
      {status !== "valid" && (
        <Button asChild variant="card2" className="w-fit">
          <Link href={signedIn ? "/home" : "/"}>
            {signedIn ? "Go home" : "Back to Remember Me"}
          </Link>
        </Button>
      )}
    </>
  );
}

/** An invite link: who invited you, and Accept (or sign up / log in first). */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <AuthShell panel={<SignUpPanel />} panelClassName={signUpPanelClass}>
      <Suspense fallback={<div aria-busy="true" className="h-40" />}>
        <Invite params={params} />
      </Suspense>
    </AuthShell>
  );
}
