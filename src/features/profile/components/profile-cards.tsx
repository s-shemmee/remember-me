import {
  CalendarHeartIcon,
  CakeIcon,
  ChevronRightIcon,
  GiftIcon,
  LockIcon,
  type LucideIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";

import { pastelClasses } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import type { Pastel } from "@/styles/tokens";

/** Profile: people, wishlists and days remembered. Always shown, 0 included. */
export function ProfileStats({
  people,
  wishlists,
  days,
}: {
  people: number;
  wishlists: number;
  days: number;
}) {
  const tiles: { label: string; value: number; Icon: LucideIcon; pastel: Pastel }[] = [
    { label: people === 1 ? "person" : "people", value: people, Icon: UsersIcon, pastel: "sky" },
    {
      label: wishlists === 1 ? "wishlist" : "wishlists",
      value: wishlists,
      Icon: GiftIcon,
      pastel: "mint",
    },
    {
      label: days === 1 ? "day remembered" : "days remembered",
      value: days,
      Icon: CalendarHeartIcon,
      pastel: "lilac",
    },
  ];
  return (
    <ul aria-label="Your numbers" className="grid grid-cols-3 gap-3 sm:gap-4">
      {tiles.map(({ label, value, Icon, pastel }) => (
        <li
          key={label}
          className={cn(
            "flex min-w-0 flex-col gap-1 rounded-card px-4 py-4 sm:px-5",
            pastelClasses[pastel],
          )}
        >
          <Icon aria-hidden className="size-5" />
          <span className="text-[28px] leading-none font-extrabold tracking-[-0.03em]">
            {value}
          </span>
          <span className="text-13 font-semibold">{label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Profile → Who can see what: a summary. The birthday switch and your data
 * live in Settings → Privacy.
 */
export function WhoSeesWhat({ shareBirthday }: { shareBirthday: boolean }) {
  const rows: { label: string; value: string; Icon: LucideIcon }[] = [
    {
      label: "Your birthday",
      value: shareBirthday ? "Your connections (day and month)" : "Only you",
      Icon: CakeIcon,
    },
    { label: "Year you were born", value: "Only you", Icon: LockIcon },
    { label: "Birthday wishlist", value: "Your connections", Icon: GiftIcon },
    { label: "Treat yourself", value: "Only you", Icon: LockIcon },
  ];
  return (
    <section
      aria-labelledby="who-sees-title"
      className="flex flex-col gap-4 rounded-card-lg bg-card p-6 shadow-card"
    >
      <div className="flex flex-col gap-1">
        <h2 id="who-sees-title" className="text-22 font-extrabold tracking-[-0.02em]">
          Who can see what
        </h2>
        <p className="text-15 text-sub">Your connections only ever see what&apos;s below.</p>
      </div>
      <dl className="flex flex-col gap-2">
        {rows.map(({ label, value, Icon }) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 rounded-[16px] bg-card2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <dt className="flex min-w-0 items-center gap-2.5 text-15 font-bold">
              <Icon aria-hidden className="size-[18px] shrink-0 text-accent-text" />
              {label}
            </dt>
            <dd className="pl-7 text-14 text-sub sm:pl-0 sm:text-right">{value}</dd>
          </div>
        ))}
      </dl>
      <Link
        href="/settings/privacy"
        className="inline-flex min-h-11 items-center gap-1 self-start text-14 font-semibold text-accent-text underline-offset-4 hover:underline"
      >
        Change in privacy settings
        <ChevronRightIcon aria-hidden className="size-4" />
      </Link>
    </section>
  );
}
