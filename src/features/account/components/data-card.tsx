"use client";

import { DownloadIcon, TriangleAlertIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";

import { type AccountResult, deleteAccount } from "../actions";

/** Settings → Privacy → Your data: everything as a JSON file. */
export function DownloadDataCard() {
  return (
    <section
      id="data"
      aria-labelledby="data-title"
      className="flex scroll-mt-6 flex-col items-start gap-2 rounded-card-lg bg-card p-5 shadow-card sm:p-6"
    >
      <h2 id="data-title" className="flex items-center gap-2 text-17 font-bold">
        <DownloadIcon aria-hidden className="size-5 text-accent-text" />
        Your data
      </h2>
      <p className="text-14 text-sub">
        It&apos;s yours. Your profile, people and their days, wishlists, reminder settings and the
        gifts you reserved, as a JSON file.
      </p>
      <Button asChild variant="card2">
        <a href="/settings/export" download>
          Download my data
        </a>
      </Button>
    </section>
  );
}

/**
 * Settings → Account, last: the danger card. Delete the account (type your
 * email; your password too for email accounts; Google accounts need a recent
 * sign-in). The Edge Function checks all of it again.
 */
export function DeleteAccountCard({
  email,
  mode,
}: {
  email: string;
  mode: "password" | "recent-sign-in";
}) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [result, setResult] = React.useState<AccountResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const trigger = React.useRef<HTMLButtonElement>(null);

  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  const error = result && !result.ok ? result : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const r = await deleteAccount({
      email: typed.trim(),
      password: mode === "password" ? password : undefined,
    });
    // On success the action redirects; we only get here on a problem.
    setBusy(false);
    setResult(r);
  };

  return (
    <section
      id="delete"
      aria-labelledby="delete-title"
      className="flex scroll-mt-6 flex-col gap-4 rounded-card-lg border-[1.5px] border-accent-text/40 bg-card p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-col items-start gap-2">
        <h2
          id="delete-title"
          className="flex items-center gap-2 text-17 font-bold text-accent-text"
        >
          <TriangleAlertIcon aria-hidden className="size-5" />
          Delete my account
        </h2>
        <p className="text-14 text-sub">
          Everything goes for good: your profile, people, days, wishes, photos, reservations and
          notifications. This can&apos;t be undone.
        </p>
        <Button
          ref={trigger}
          variant="card2"
          className="text-accent-text"
          onClick={() => {
            setResult(null);
            setTyped("");
            setPassword("");
            setOpen(true);
          }}
        >
          Delete my account…
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
        >
          <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Your people, days, wishlists, photos and settings are deleted for good, and
              you&apos;re signed out. Type your email to confirm.
            </DialogDescription>
            <Field
              id="delete-email"
              label={`Type ${email}`}
              type="email"
              autoComplete="off"
              value={typed}
              error={error?.field === "email" ? error.message : undefined}
              onChange={(e) => setTyped(e.currentTarget.value)}
            />
            {mode === "password" ? (
              <PasswordField
                id="delete-password"
                label="Your password"
                autoComplete="current-password"
                value={password}
                error={error?.field === "password" ? error.message : undefined}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
            ) : (
              <p className="text-14 text-sub">
                For your safety, this works within 10 minutes of logging in with Google.
              </p>
            )}
            <p role="alert" className="text-14 font-semibold text-accent-text empty:hidden">
              {error && !error.field ? error.message : ""}
            </p>
            <DialogFooter>
              <Button type="button" variant="card2" onClick={() => setOpen(false)}>
                Keep my account
              </Button>
              <Button type="submit" disabled={busy || !matches}>
                {busy ? "Deleting…" : "Delete forever"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
