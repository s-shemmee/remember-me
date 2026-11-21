import { SavedThemeToggle } from "@/features/profile/components/saved-theme-toggle";
import { cn } from "@/lib/utils";

import { NotificationBell } from "./header-actions";

/**
 * The one page header for every signed-in page. Left: the title (and a line
 * under it). Right, always in this order, skipping what a page doesn't
 * have: search → primary button → theme toggle → notification bell (always
 * last). On phones the actions are 44px icon buttons in the same order, and
 * the search field opens on its own line below.
 *
 * Pages pass `bell={notificationsInboxEnabled()}`; off, nothing renders and
 * there's no gap.
 */
export function PageHeader({
  title,
  subtitle,
  search,
  primary,
  theme = true,
  bell,
  titleRef,
  className,
}: {
  /** The h1's content. */
  title: React.ReactNode;
  /** For pages that move focus to the title (it gets tabIndex -1). */
  titleRef?: React.Ref<HTMLHeadingElement>;
  subtitle?: React.ReactNode;
  /** A <HeaderSearch>. */
  search?: React.ReactNode;
  /** The page's one main action: a labelled pill from 1024px, a 44px icon button below. */
  primary?: React.ReactNode;
  /** The light/dark toggle (Home has none). */
  theme?: boolean;
  bell: boolean;
  className?: string;
}) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex flex-wrap items-start gap-x-2 gap-y-3 sm:gap-x-3 lg:items-center lg:gap-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 basis-0 flex-col gap-1 lg:basis-[320px]">
        <h1
          ref={titleRef}
          tabIndex={titleRef ? -1 : undefined}
          className="text-[28px] leading-tight font-extrabold tracking-[-0.03em] [overflow-wrap:anywhere] outline-none sm:text-34"
        >
          {title}
        </h1>
        {subtitle && <p className="text-15 text-sub">{subtitle}</p>}
      </div>
      {search}
      {primary}
      {theme && <SavedThemeToggle />}
      {bell && <NotificationBell />}
    </header>
  );
}

/**
 * A header action that's a labelled pill from 1024px and a 44px icon button
 * below (the label stays as its accessible name). Put the icon first and the
 * label in <HeaderLabel>.
 */
export const headerPrimaryClass = "max-lg:size-11 max-lg:min-h-11 max-lg:px-0";

export function HeaderLabel({ children }: { children: React.ReactNode }) {
  return <span className="max-lg:sr-only">{children}</span>;
}

/** The skeleton while a page's data loads: the same header, actions left out. */
export function PageHeaderFallback({ title }: { title: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center">
      <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.03em] sm:text-34">
        {title}
      </h1>
    </div>
  );
}
