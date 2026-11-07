import type { Metadata } from "next";

import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell";
import { SignUpPanel, signUpPanelClass } from "@/features/auth/components/panels";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export const metadata: Metadata = { title: "Create your account · Remember Me" };

export default function SignUpPage() {
  return (
    <AuthShell panel={<SignUpPanel />} panelClassName={signUpPanelClass}>
      <AuthHeading
        accent="someone"
        lead="Create your free account. Your first person is one minute away."
      >
        Let&apos;s remember
      </AuthHeading>
      <SignUpForm />
    </AuthShell>
  );
}
