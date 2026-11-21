"use client";

import { UserRoundCogIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";

import { forgetThemeUser } from "@/lib/theme";

import { type AccountResult, changeEmail, changePassword, logOutEverywhere } from "../actions";

type Mode = "password" | "recent-sign-in";

function Status({ result }: { result: AccountResult | null }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={
        result && !result.ok ? "text-14 font-semibold text-accent-text" : "text-14 text-sub"
      }
    >
      {result?.message ?? ""}
    </p>
  );
}

/**
 * Settings → Account: change email (re-authenticate first; Supabase
 * confirms by email), change password (email accounts only) and log out of
 * all devices.
 */
export function AccountCard({ email, mode }: { email: string; mode: Mode }) {
  const [newEmail, setNewEmail] = React.useState("");
  const [emailPassword, setEmailPassword] = React.useState("");
  const [emailResult, setEmailResult] = React.useState<AccountResult | null>(null);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [passwordResult, setPasswordResult] = React.useState<AccountResult | null>(null);
  const [busy, setBusy] = React.useState<"" | "email" | "password" | "everywhere">("");

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("email");
    const result = await changeEmail({
      email: newEmail.trim(),
      password: mode === "password" ? emailPassword : undefined,
    });
    setBusy("");
    setEmailResult(result);
    if (result.ok) {
      setNewEmail("");
      setEmailPassword("");
    }
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("password");
    const result = await changePassword({ current, next });
    setBusy("");
    setPasswordResult(result);
    if (result.ok) {
      setCurrent("");
      setNext("");
    }
  };

  const emailError = emailResult && !emailResult.ok ? emailResult : null;
  const passwordError = passwordResult && !passwordResult.ok ? passwordResult : null;

  return (
    <section
      id="account"
      aria-labelledby="account-title"
      className="flex scroll-mt-6 flex-col gap-6 rounded-card-lg bg-card p-6 shadow-card sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="account-title"
          className="flex items-center gap-2 text-22 font-extrabold tracking-[-0.02em]"
        >
          <UserRoundCogIcon aria-hidden className="size-5 text-accent-text" />
          Account
        </h2>
        <p className="text-15 [overflow-wrap:anywhere] text-sub">Signed in as {email}</p>
      </div>

      <form onSubmit={(e) => void submitEmail(e)} noValidate className="flex flex-col gap-3">
        <h3 className="text-17 font-bold">Change email</h3>
        <Field
          id="account-new-email"
          label="New email"
          type="email"
          autoComplete="email"
          value={newEmail}
          error={emailError?.field === "email" ? emailError.message : undefined}
          onChange={(e) => setNewEmail(e.currentTarget.value)}
        />
        {mode === "password" ? (
          <PasswordField
            id="account-email-password"
            label="Current password"
            autoComplete="current-password"
            value={emailPassword}
            error={emailError?.field === "password" ? emailError.message : undefined}
            onChange={(e) => setEmailPassword(e.currentTarget.value)}
          />
        ) : (
          <p className="text-14 text-sub">
            For your safety, this works within 10 minutes of logging in with Google.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="card2" disabled={busy !== ""}>
            {busy === "email" ? "Sending…" : "Change email"}
          </Button>
          <Status result={emailError?.field ? null : emailResult} />
        </div>
      </form>

      {mode === "password" && (
        <form onSubmit={(e) => void submitPassword(e)} noValidate className="flex flex-col gap-3">
          <h3 className="text-17 font-bold">Change password</h3>
          <PasswordField
            id="account-current-password"
            label="Current password"
            autoComplete="current-password"
            value={current}
            error={passwordError?.field === "current" ? passwordError.message : undefined}
            onChange={(e) => setCurrent(e.currentTarget.value)}
          />
          <PasswordField
            id="account-new-password"
            label="New password"
            autoComplete="new-password"
            minLength={8}
            value={next}
            error={passwordError?.field === "next" ? passwordError.message : undefined}
            onChange={(e) => setNext(e.currentTarget.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="card2" disabled={busy !== ""}>
              {busy === "password" ? "Saving…" : "Change password"}
            </Button>
            <Status result={passwordError?.field ? null : passwordResult} />
          </div>
        </form>
      )}

      <div className="flex flex-col items-start gap-2">
        <h3 className="text-17 font-bold">Your devices</h3>
        <p className="text-14 text-sub">
          Signs you out everywhere, including this browser, and stops notifications on all of them.
        </p>
        <Button
          variant="card2"
          disabled={busy !== ""}
          onClick={() => {
            setBusy("everywhere");
            forgetThemeUser();
            void logOutEverywhere();
          }}
        >
          {busy === "everywhere" ? "Logging out…" : "Log out of all devices"}
        </Button>
      </div>
    </section>
  );
}
