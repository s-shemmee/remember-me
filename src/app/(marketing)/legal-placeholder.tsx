import Link from "next/link";
import type * as React from "react";

import { Logo } from "@/components/ui/logo";

/** Placeholder for legal pages until the real ones land (M6, before launch). */
export function LegalPlaceholder({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col gap-10 px-4 py-6 sm:px-10">
      <header>
        <Logo />
      </header>
      <main id="main" className="grid gap-4">
        <h1 className="text-34 font-extrabold tracking-heading sm:text-44">{title}</h1>
        <div className="grid gap-3 text-17 text-sub">{children}</div>
        <p className="text-15">
          <Link href="/" className="font-semibold text-accent-text underline underline-offset-2">
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
