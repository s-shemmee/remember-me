"use client";

import { SearchIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { InboxBell } from "@/features/inbox/components/inbox-bell";
import { cn } from "@/lib/utils";

/**
 * The search in a page header. From 1024px it's the field itself. Below, a
 * 44px search button comes first in the row of icons and opens the field on
 * its own line under the header (focused at once). The wrapper is
 * `display: contents`, so the button and the field each take their own place
 * in the header's flex row.
 */
export function HeaderSearch({
  inputId,
  label,
  defaultOpen = false,
  children,
}: {
  /** The id of the input inside `children` (focused when the field opens). */
  inputId: string;
  /** "Search people": the button's name. */
  label: string;
  /** Open on phones too, e.g. when the page already has a search. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const fieldId = `${inputId}-field`;
  return (
    <div className="contents">
      <div
        id={fieldId}
        data-slot="header-search"
        className={cn(
          open ? "flex" : "hidden",
          "order-last min-w-0 basis-full lg:order-none lg:flex lg:w-[280px] lg:basis-auto",
        )}
      >
        {children}
      </div>
      <Button
        variant="card2"
        size="icon"
        aria-label={label}
        aria-expanded={open}
        aria-controls={fieldId}
        className="lg:hidden"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) requestAnimationFrame(() => document.getElementById(inputId)?.focus());
        }}
      >
        <SearchIcon aria-hidden />
      </Button>
    </div>
  );
}

/** The search input's look (pill, icon on the left). */
export const headerSearchInputClass =
  "min-h-11 w-full rounded-pill border-[1.5px] border-line bg-card pr-4 pl-11 text-15 text-text placeholder:text-sub focus:border-accent focus:outline-none";

export function HeaderSearchIcon() {
  return (
    <SearchIcon
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-sub"
    />
  );
}

/**
 * The notification bell, always last in a page header, behind
 * NOTIFICATIONS_INBOX_ENABLED: the inbox (src/features/inbox).
 */
export function NotificationBell() {
  return <InboxBell />;
}
