import type { Metadata } from "next";
import Link from "next/link";

import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell";
import { LogInPanel, logInPanelClass } from "@/features/auth/components/panels";
import { ForgotPasswordForm } from "@/features/auth/components/password-forms";

export const metadata: Metadata = { title: "Forgot password · Remember Me" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell panel={<LogInPanel />} panelClassName={logInPanelClass}>
      <div className="grid gap-8">
        <AuthHeading
          accent="happens"
          lead="Tell us your email and we'll send you a link to choose a new password."
        >
          It
        </AuthHeading>
        <ForgotPasswordForm />
        <p className="text-15 text-sub">
          Remembered it?{" "}
          <Link
            href="/log-in"
            className="inline-flex min-h-11 items-center font-semibold text-accent-text underline-offset-2 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
