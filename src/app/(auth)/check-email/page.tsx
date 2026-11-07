import type { Metadata } from "next";

import { AuthHeading, AuthShell, AuthSwitch } from "@/features/auth/components/auth-shell";
import { SignUpPanel, signUpPanelClass } from "@/features/auth/components/panels";
import { ResendConfirmationForm } from "@/features/auth/components/password-forms";

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
      <ResendConfirmationForm />
      <AuthSwitch question="Wrong email?" href="/sign-up">
        Sign up again
      </AuthSwitch>
    </AuthShell>
  );
}
