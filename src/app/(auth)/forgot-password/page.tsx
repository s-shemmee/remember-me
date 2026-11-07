import type { Metadata } from "next";

import { AuthHeading, AuthShell, AuthSwitch } from "@/features/auth/components/auth-shell";
import { LogInPanel, logInPanelClass } from "@/features/auth/components/panels";
import { ForgotPasswordForm } from "@/features/auth/components/password-forms";

export const metadata: Metadata = { title: "Forgot password · Remember Me" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell panel={<LogInPanel />} panelClassName={logInPanelClass}>
      <AuthHeading
        accent="happens"
        lead="Tell us your email and we'll send you a link to choose a new password."
      >
        It
      </AuthHeading>
      <ForgotPasswordForm />
      <AuthSwitch question="Remembered it?" href="/log-in">
        Log in
      </AuthSwitch>
    </AuthShell>
  );
}
