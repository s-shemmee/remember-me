"use client";

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

/**
 * Settings → Your data: download everything as JSON, or delete the account
 * (type your email; your password too for email accounts; Google accounts
 * need a recent sign-in). The Edge Function checks all of it again.
 */
export function DataCard({ email, mode }: { email: string; mode: "password" | "recent-sign-in" }) {
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
      id="data"
      aria-labelledby="data-title"
      className="flex scroll-mt-6 flex-col gap-6 rounded-card-lg bg-card p-6 shadow-card sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id="data-title" className="text-22 font-extrabold tracking-[-0.02em]">
          <span aria-hidden>📦 </span>Your data
        </h2>
        <p className="text-15 text-sub">It&apos;s yours. Take it with you, or take it away.</p>
      </div>

      <div className="flex flex-col items-start gap-2">
        <h3 className="text-17 font-bold">Download my data</h3>
        <p className="text-14 text-sub">
          Your profile, people and their days, wishlists, reminder settings and the gifts you
          reserved, as a JSON file.
        </p>
        <Button asChild variant="card2">
          <a href="/settings/export" download>
            Download my data
          </a>
        </Button>
      </div>

      <div className="flex flex-col items-start gap-2">
        <h3 className="text-17 font-bold">Delete my account</h3>
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
