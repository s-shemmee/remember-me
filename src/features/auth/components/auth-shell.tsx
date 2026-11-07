import Link from "next/link";
import type * as React from "react";

import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Layout for the auth pages (SignUp / LogIn screens):
 * - a full-width top bar: logo left, "← Back to home" and the theme toggle right;
 * - below it, the form column (max 420px, vertically centred) and, from lg
 *   up, a decorative example panel. The panel is aria-hidden: it only shows
 *   clearly labelled sample content.
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
    <div className="flex min-h-dvh w-full flex-col">
      <header className="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-2 px-4 py-5 sm:gap-4 sm:px-8">
        <Logo label="Remember me, back to home" />
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex min-h-11 min-w-11 items-center rounded-pill px-1.5 text-15 font-semibold whitespace-nowrap text-sub transition-[transform,color] duration-200 ease-soft hover:-translate-y-px hover:text-text sm:px-[18px]"
          >
            <span aria-hidden>←&nbsp;</span>
            {/* Short label on narrow phones so the bar fits at 320px. */}
            <span className="sm:hidden">Home</span>
            <span className="hidden sm:inline">Back to home</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1360px] flex-1 items-stretch">
        <main
          id="main"
          className="flex min-w-0 flex-[1_1_440px] items-center justify-center px-4 pt-6 pb-12 sm:px-8 sm:pt-8"
        >
          <div className="flex w-full max-w-[420px] flex-col gap-[22px]">{children}</div>
        </main>

        {panel && (
          <aside
            aria-hidden
            className={cn(
              "relative mr-6 mb-6 hidden min-h-[760px] min-w-0 flex-[1_1_560px] overflow-hidden rounded-panel-lg lg:block",
              panelClassName,
            )}
          >
            {panel}
          </aside>
        )}
      </div>
    </div>
  );
}

/** "Let's remember *someone*": heading with one serif-italic accent word. */
export function AuthHeading({
  children,
  accent,
  after,
  lead,
}: {
  children: React.ReactNode;
  accent: string;
  /** A decorative emoji after the heading ("Welcome back 🤍"). */
  after?: string;
  lead: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <h1 className="text-34 leading-[1.1] font-extrabold tracking-heading sm:text-44">
        {children} <em className="font-serif font-normal text-accent-text">{accent}</em>
        {after && <span aria-hidden> {after}</span>}
      </h1>
      <p className="text-17 leading-[1.55] text-sub">{lead}</p>
    </div>
  );
}

/** "Already have an account? Log in": centred, link in accentText at 700. */
export function AuthSwitch({
  question,
  href,
  children,
}: {
  question: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <p className="text-center text-15 text-sub">
      {question}{" "}
      <Link
        href={href}
        className="inline-flex min-h-11 items-center font-bold text-accent-text underline-offset-2 hover:underline"
      >
        {children}
      </Link>
    </p>
  );
}

/** The "or with email" divider between Google and the email form. */
export function OrDivider() {
  return (
    <div
      className="flex items-center gap-3 text-14 text-sub"
      role="separator"
      aria-label="or with email"
    >
      <span aria-hidden className="h-px flex-1 bg-line" />
      <span aria-hidden>or with email</span>
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
