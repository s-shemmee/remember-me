"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { NotificationBell } from "@/features/shell/header-actions";
import { PageHeader } from "@/features/shell/page-header";
import { cn } from "@/lib/utils";

import { SETTINGS_SECTIONS, sectionFor } from "../sections";

/**
 * Settings' header. Desktop: "Settings", "Saved automatically as you go"
 * and the pill tab bar. Phones: on /settings the same title over the grouped
 * list; on a section, a back button and the section's name.
 */
export function SettingsHeader({ bell }: { bell: boolean }) {
  const section = sectionFor(usePathname());
  return (
    <>
      <PageHeader
        className={cn(section && "max-lg:hidden")}
        title="Settings"
        subtitle="Saved automatically as you go"
        theme={false}
        bell={bell}
      />
      {section && (
        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/settings"
            className="-ml-2 grid size-11 shrink-0 place-items-center rounded-pill hover-tint"
          >
            <ChevronLeftIcon aria-hidden className="size-6" />
            <span className="sr-only">Back to Settings</span>
          </Link>
          <h1 className="min-w-0 flex-1 text-[28px] leading-tight font-extrabold tracking-[-0.03em]">
            {section.title}
          </h1>
          {bell && <NotificationBell />}
        </div>
      )}
      <SettingsTabs />
    </>
  );
}

/** Desktop: one pill per section, links with aria-current="page". */
function SettingsTabs() {
  const current = sectionFor(usePathname())?.slug;
  return (
    <nav aria-label="Settings" className="max-lg:hidden">
      <ul className="flex w-fit flex-wrap gap-1 rounded-pill bg-card2 p-1">
        {SETTINGS_SECTIONS.map(({ slug, title, Icon }) => {
          const on = slug === current;
          return (
            <li key={slug}>
              <Link
                href={`/settings/${slug}`}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-pill hover-tint px-4 text-15 font-semibold transition-colors duration-200 ease-soft",
                  on ? "bg-card text-text shadow-card" : "text-sub hover:text-text",
                )}
              >
                <Icon aria-hidden className="size-[18px] text-accent-text" />
                {title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phones, at /settings: the five sections as a grouped list. */
export function SettingsList() {
  return (
    <nav aria-label="Settings sections" className="lg:hidden">
      <ul className="flex flex-col overflow-hidden rounded-card-lg bg-card shadow-card">
        {SETTINGS_SECTIONS.map(({ slug, title, subtitle, Icon }) => (
          <li key={slug} className="border-line not-last:border-b">
            <Link
              href={`/settings/${slug}`}
              className="flex min-h-[60px] items-center gap-3.5 hover-tint px-4 py-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-card2">
                <Icon aria-hidden className="size-5 text-accent-text" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-15 font-bold">{title}</span>
                <span className="text-13 text-sub">{subtitle}</span>
              </span>
              <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-sub" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Desktop only: /settings opens the first section (phones keep the list). */
export function DesktopSettingsRedirect() {
  const router = useRouter();
  React.useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) router.replace("/settings/reminders");
  }, [router]);
  return null;
}
