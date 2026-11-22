import Link from "next/link";

import { pastelClasses } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import type { Pastel } from "@/styles/tokens";

/** Your card's numbers: people, wishlists and days remembered. Always shown, 0 included. */
export function ProfileStats({
  people,
  wishlists,
  days,
}: {
  people: number;
  wishlists: number;
  days: number;
}) {
  const tiles = [
    { label: people === 1 ? "person" : "people", value: people },
    { label: wishlists === 1 ? "wishlist" : "wishlists", value: wishlists },
    { label: days === 1 ? "day remembered" : "days remembered", value: days },
  ];
  return (
    <ul aria-label="Your numbers" className="grid w-full grid-cols-3 gap-2">
      {tiles.map(({ label, value }) => (
        <li
          key={label}
          className="flex min-w-0 flex-col items-center gap-1 rounded-[18px] bg-card/70 px-2 py-3 text-center"
        >
          <span className="text-[24px] leading-none font-extrabold tracking-[-0.03em]">
            {value}
          </span>
          <span className="text-12 leading-tight font-semibold">{label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Profile → Who can see what: a summary in three tiles. The birthday switch
 * and your data live in Settings → Privacy.
 */
export function WhoSeesWhat({ shareBirthday }: { shareBirthday: boolean }) {
  const tiles: { emoji: string; label: string; value: string; pastel: Pastel }[] = [
    {
      emoji: "🎂",
      label: "Your birthday",
      value: shareBirthday ? "Your connections" : "Only you",
      pastel: "butter",
    },
    { emoji: "🎁", label: "Birthday wishlist", value: "Your connections", pastel: "mint" },
    { emoji: "🔒", label: "Treat yourself", value: "Only you", pastel: "lilac" },
  ];
  return (
    <section
      aria-labelledby="who-sees-title"
      className="flex flex-col gap-4 rounded-card-lg bg-card p-6 shadow-card sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="who-sees-title" className="text-22 font-extrabold tracking-[-0.02em]">
          Who can see what
        </h2>
        <Link
          href="/settings/privacy"
          className="inline-flex min-h-11 items-center text-14 font-semibold text-accent-text underline-offset-4 hover:underline"
        >
          Privacy settings
        </Link>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {tiles.map(({ emoji, label, value, pastel }) => (
          <div
            key={label}
            className={cn("flex min-w-0 flex-col gap-1 rounded-[20px] p-4", pastelClasses[pastel])}
          >
            <dt className="flex min-w-0 flex-col gap-1.5 text-15 font-bold">
              <span aria-hidden="true" className="text-[22px] leading-none">
                {emoji}
              </span>
              {label}
            </dt>
            <dd className="text-14 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
