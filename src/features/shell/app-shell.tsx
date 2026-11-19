import Link from "next/link";

import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

import { SavedThemeToggle } from "@/features/profile/components/saved-theme-toggle";

import { type Account, AccountMenu } from "./account-menu";
import { SidebarNav, SidebarSettingsLink, TabBar } from "./nav";

export type YourDay = {
  /** Days until your birthday; 0 is today. */
  daysUntil: number;
  /** "Sun, 22 Nov". */
  date: string;
  /** Your own plan for that day, once you've started one. */
  plan?: { done: number; total: number } | null;
};

function yourDayHeadline(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

/** The lilac "Your day" card: a countdown to your birthday, linking to Celebrate Me. */
function YourDayCard({ yourDay }: { yourDay: YourDay }) {
  return (
    <Link
      href="/celebrate"
      className="hover-tint mt-[18px] flex flex-col gap-2 rounded-[20px] bg-lilac p-4 text-lilac-ink transition-transform duration-200 ease-soft hover:-translate-y-px motion-reduce:hover:translate-y-0"
    >
      <span className="text-12 font-bold tracking-[.05em]">YOUR DAY</span>
      <span className="text-[28px] leading-none font-extrabold tracking-[-0.03em]">
        {yourDayHeadline(yourDay.daysUntil)}
        {yourDay.daysUntil === 0 && <span aria-hidden> 🎂</span>}
      </span>
      <span className="text-13">
        {yourDay.date}
        {yourDay.plan && yourDay.plan.total > 0
          ? ` · plan ${yourDay.plan.done} of ${yourDay.plan.total} ready`
          : ""}
      </span>
    </Link>
  );
}

/**
 * The app shell for every signed-in page (docs/design-system.md, "Sidebar").
 * From 1024px: the 248px sidebar with the five sections, "Your day",
 * Settings and the account chip. Below: a top bar with the logo and the
 * account menu, and a tab bar at the bottom. Pages render their own <main>.
 */
export function AppShell({
  account,
  yourDay,
  children,
}: {
  account: Account;
  yourDay: YourDay | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col lg:flex-row">
      <aside
        aria-label="App"
        className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-line px-4 py-6 lg:flex"
      >
        <Logo href="/home" label="Remember me, home" className="mb-4 px-2.5" />
        <SidebarNav />
        {yourDay && <YourDayCard yourDay={yourDay} />}
        <div className="mt-auto flex flex-col gap-1 pt-6">
          <SidebarSettingsLink />
          <AccountMenu account={account} variant="chip" />
        </div>
      </aside>

      {/* Phones and tablets: logo on the left, theme toggle and account on the right. */}
      <header className="flex items-center justify-between gap-3 px-4 pt-3 sm:px-8 lg:hidden">
        <Logo href="/home" label="Remember me, home" />
        <div className="flex items-center gap-2">
          <SavedThemeToggle />
          <AccountMenu account={account} variant="avatar" />
        </div>
      </header>

      {/* Room at the bottom for the tab bar on phones. */}
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </div>

      <TabBar className="lg:hidden" />
    </div>
  );
}

/** The <main> of an app page, with the shell's padding. */
export function AppMain({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className={cn(
        "flex w-full min-w-0 flex-1 flex-col gap-6 px-4 py-5 outline-none sm:px-8 lg:px-10 lg:pt-6 lg:pb-12",
        className,
      )}
    >
      {children}
    </main>
  );
}
