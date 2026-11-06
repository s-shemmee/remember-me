import Link from "next/link";
import type * as React from "react";

import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Layout for the auth pages (SignUp / LogIn screens): the form on the left,
 * a decorative example panel on the right from lg up. The panel is
 * aria-hidden: it only shows clearly labelled sample content.
 */
export function AuthShell({
  children,
  panel,
  panelClassName,
}: {
  children: React.ReactNode;
  panel?: React.ReactNode;
  /** Gradient for the panel background. */
  panelClassName?: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1360px]">
      <div className="flex min-w-0 flex-1 flex-col px-4 py-4 sm:px-10 sm:py-6 lg:max-w-[640px]">
        <header className="flex items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-1">
            <Link
              href="/"
              className="hidden min-h-11 items-center rounded-pill px-3 text-15 font-semibold text-sub hover:text-text sm:inline-flex"
            >
              <span aria-hidden>←&nbsp;</span>Back to home
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main
          id="main"
          className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10"
        >
          {children}
        </main>
      </div>

      {panel && (
        <aside
          aria-hidden
          className={cn(
            "relative my-6 mr-6 hidden min-h-[760px] min-w-0 flex-1 overflow-hidden rounded-panel-lg lg:block",
            panelClassName,
          )}
        >
          {panel}
        </aside>
      )}
    </div>
  );
}

/** "Let's remember *someone*": heading with one serif-italic accent word. */
export function AuthHeading({
  children,
  accent,
  lead,
}: {
  children: React.ReactNode;
  accent: string;
  lead: React.ReactNode;
}) {
  return (
    <div className="grid gap-3">
      <h1 className="text-34 leading-[1.05] font-extrabold tracking-heading sm:text-44">
        {children} <em className="font-serif font-normal text-accent-text">{accent}</em>
      </h1>
      <p className="text-17 text-sub">{lead}</p>
    </div>
  );
}

/** The "or" divider between Google and the email form. */
export function OrDivider() {
  return (
    <div
      className="flex items-center gap-3 text-13 font-semibold text-sub"
      role="separator"
      aria-label="or"
    >
      <span aria-hidden className="h-px flex-1 bg-line" />
      <span aria-hidden>or</span>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Whole-form message: an error (role=alert) or a calm notice (role=status). */
export function FormMessage({ error, notice }: { error?: string; notice?: string }) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-input bg-rose px-4 py-3 text-15 font-semibold text-rose-ink"
      >
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p
        role="status"
        className="rounded-input bg-mint px-4 py-3 text-15 font-semibold text-mint-ink"
      >
        {notice}
      </p>
    );
  }
  return null;
}
