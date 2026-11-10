"use client";

import {
  CalendarDaysIcon,
  GiftIcon,
  HouseIcon,
  SettingsIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** The five sections, in the sidebar (desktop) and the tab bar (mobile). */
export const NAV_ITEMS = [
  { href: "/home", label: "Home", short: "Home", Icon: HouseIcon },
  { href: "/people", label: "People", short: "People", Icon: UsersIcon },
  { href: "/calendar", label: "Calendar", short: "Calendar", Icon: CalendarDaysIcon },
  { href: "/wishlists", label: "Wishlists", short: "Wishlists", Icon: GiftIcon },
  { href: "/celebrate", label: "Celebrate Me", short: "Celebrate", Icon: StarIcon },
] as const;

const isCurrent = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const navItemClass = (current: boolean) =>
  cn(
    "flex min-h-11 items-center gap-3 rounded-item px-3.5 text-15 font-semibold transition-colors duration-200 ease-soft",
    current ? "bg-card text-text shadow-card" : "text-sub hover:bg-card2 hover:text-text",
  );

/** Sidebar links: the five sections. The current page is marked aria-current. */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={navItemClass(current)}
          >
            <Icon aria-hidden className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Settings, at the bottom of the sidebar. */
export function SidebarSettingsLink() {
  const current = isCurrent(usePathname(), "/settings");
  return (
    <Link
      href="/settings"
      aria-current={current ? "page" : undefined}
      className={navItemClass(current)}
    >
      <SettingsIcon aria-hidden className="size-5" />
      Settings
    </Link>
  );
}

/**
 * Mobile tab bar: the five sections with icons and labels, fixed to the
 * bottom with room for the phone's home indicator.
 */
export function TabBar({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-glass backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <ul className="mx-auto flex max-w-xl">
        {NAV_ITEMS.map(({ href, short, Icon }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 text-12 font-semibold transition-colors duration-200 ease-soft",
                  current ? "text-accent-text" : "text-sub hover:text-text",
                )}
              >
                <Icon aria-hidden className="size-6" strokeWidth={current ? 2.4 : 2} />
                <span className="max-w-full truncate">{short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
