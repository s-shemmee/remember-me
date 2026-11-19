"use client";

import Link from "next/link";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { FilterChip, pastelClasses } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

import type { DayEvent } from "../days/days";
import { occasionType } from "../occasions/types";
import { PlanDots } from "../plans/components/plan-dots";
import { usePlans } from "../plans/components/plan-state";
import { targetFor } from "../plans/steps";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "birthday", label: "Birthdays" },
  { key: "anniversary", label: "Anniversaries" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const SHOWN = 8;

const EMPTY: Record<Filter, string> = {
  all: "Nothing coming up yet.",
  birthday: "No birthdays coming up.",
  anniversary: "No anniversaries coming up.",
};

/** "Birthday, turns 30", "Anniversary, 32 years", "Graduation", or the day's title. */
function what(e: DayEvent) {
  const s = e.source;
  const kind = s.title?.trim() || occasionType(s.kind).label;
  if (!e.detail) return kind;
  return s.kind === "birthday" ? `${kind}, ${e.detail.toLowerCase()}` : `${kind}, ${e.detail}`;
}

/**
 * Home's "Coming up" (AppHome.dc.html): your people's next days, soonest
 * first, filtered by All / Birthdays / Anniversaries. Each row opens the
 * person on People. A day with a plan shows its dots (one per step, filled
 * when done); a day without one shows none.
 */
export function ComingUp({ events }: { events: DayEvent[] }) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const { plans } = usePlans();
  const shown = events.filter((e) => filter === "all" || e.source.kind === filter);

  return (
    <section
      aria-labelledby="coming-up"
      className="flex min-w-0 flex-col gap-3.5 rounded-[28px] bg-card p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="coming-up" className="text-22 font-extrabold tracking-[-0.02em]">
          Coming up
        </h2>
        <div role="group" aria-label="Filter coming up" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <FilterChip key={f.key} selected={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {shown.length ? (
        <ul className="flex flex-col gap-1">
          {shown.slice(0, SHOWN).map((e) => (
            <li key={e.key}>
              <Link
                href={`/people?person=${e.source.personId}`}
                className="flex min-w-0 items-center gap-3.5 rounded-[18px] hover-tint p-3 transition-colors duration-200 ease-soft"
              >
                <Avatar name={e.source.name} pastel={e.source.color} decorative />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-16 font-bold">{e.source.name}</span>
                  <span className="truncate text-14 text-sub">
                    {what(e)} · {e.shortDate}
                  </span>
                </span>
                {(() => {
                  const plan = plans.get(targetFor(e).key);
                  return plan ? <PlanDots plan={plan} color={e.source.color} /> : null;
                })()}
                <span
                  className={cn(
                    "shrink-0 rounded-pill px-3 py-1.5 text-center text-13 font-bold whitespace-nowrap sm:min-w-[86px]",
                    // Remembrance: a quiet pill, not the bright pastel.
                    e.gentle ? "bg-card2 text-text" : pastelClasses[e.source.color],
                  )}
                >
                  {e.when}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[18px] bg-card2 p-5 text-center text-15 text-sub">{EMPTY[filter]}</p>
      )}

      {shown.length > SHOWN && (
        <Link
          href="/calendar"
          className="inline-flex min-h-11 items-center self-start text-14 font-semibold text-accent-text underline-offset-4 hover:underline"
        >
          See all in Calendar
        </Link>
      )}
    </section>
  );
}
