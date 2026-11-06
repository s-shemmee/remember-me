import type { Metadata } from "next";

import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell";
import { LogInPanel, logInPanelClass } from "@/features/auth/components/panels";
import { ResetPasswordForm } from "@/features/auth/components/password-forms";

export const metadata: Metadata = { title: "Choose a new password · Remember Me" };

// Reached from the reset email via /auth/confirm (which signs the person in).
// Without that session, the form says the link expired.
export default function ResetPasswordPage() {
  return (
    <AuthShell panel={<LogInPanel />} panelClassName={logInPanelClass}>
      <div className="grid gap-8">
        <AuthHeading accent="password" lead="Choose a new one and you're back in.">
          A fresh
        </AuthHeading>
        <ResetPasswordForm />
      </div>
    </AuthShell>
  );
}
