import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { AuthHeading, AuthShell, AuthSwitch } from "@/features/auth/components/auth-shell";
import { SignUpPanel, signUpPanelClass } from "@/features/auth/components/panels";
import { ResendConfirmationForm } from "@/features/auth/components/password-forms";
import { AUTH_MESSAGES } from "@/features/auth/messages";

export const metadata: Metadata = { title: "Check your inbox · Remember Me" };

export default function CheckEmailPage() {
  return (
    <AuthShell panel={<SignUpPanel />} panelClassName={signUpPanelClass}>
      <AuthHeading
        accent="inbox"
        lead="We sent you a link to confirm your email. Tap it and you're in."
      >
        Check your
      </AuthHeading>
      <ul className="grid gap-2 text-15 text-sub">
        <li>It can take a minute to arrive.</li>
        <li>Not there? Look in spam or promotions.</li>
      </ul>
      <div className="grid gap-3 rounded-[20px] bg-card2 p-4">
        <p className="text-15">{AUTH_MESSAGES.accountHint}</p>
        <Button asChild size="default" className="w-full">
          <Link href="/log-in">Log in</Link>
        </Button>
      </div>
      <ResendConfirmationForm />
      <AuthSwitch question="Wrong email?" href="/sign-up">
        Sign up again
      </AuthSwitch>
    </AuthShell>
  );
}
