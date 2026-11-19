"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { pastelClasses } from "@/components/ui/chip";
import { NoorBubble } from "@/components/ui/noor-bubble";
import {
  addDays,
  addMonths,
  type CalendarDate,
  daysInMonth,
  formatFullDate,
  fromIsoDate,
  MONTHS,
  sameDate,
  toIsoDate,
  weekdayIndex,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

import { inkBg } from "../days/colors";
import { type DayEvent, type DaySource, monthEvents, monthGrid, upcoming } from "../days/days";

const WEEKDAYS = [
  ["MON", "Monday"],
  ["TUE", "Tuesday"],
  ["WED", "Wednesday"],
  ["THU", "Thursday"],
  ["FRI", "Friday"],
  ["SAT", "Saturday"],
  ["SUN", "Sunday"],
] as const;

const TAGS_SHOWN = 2;

function parseMonth(value: string | null): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : null;
}

/** Keep the same day of the month when moving months (31 Jan → 28 Feb). */
const sameDayIn = (ym: { year: number; month: number }, day: number): CalendarDate => ({
  ...ym,
  day: Math.min(day, daysInMonth(ym.month, ym.year)),
});

function EventCard({ e }: { e: DayEvent }) {
  const s = e.source;
  const sub = [e.detail, e.when].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col gap-2.5 rounded-[18px] bg-card p-3.5 shadow-card">
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full text-[18px]",
            pastelClasses[s.color],
          )}
        >
          {e.emoji}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-16 font-bold [overflow-wrap:anywhere]">{e.title}</span>
          <span className="text-13 text-sub">{sub.charAt(0).toUpperCase() + sub.slice(1)}</span>
        </span>
      </span>
      <Button asChild variant="card2" className="self-start">
        {s.isYou ? (
          <Link href="/celebrate">Open Celebrate Me</Link>
        ) : (
          <Link href={`/people?person=${s.personId}`}>
            <span className="max-w-[20ch] truncate">See {s.name}</span>
          </Link>
        )}
      </Button>
    </li>
  );
}

/**
 * Calendar (AppCalendar.dc.html): the month grid with name tags in each
 * person's colour, the selected day's details and the next 30 days.
 *
 * The grid follows the WAI-ARIA date grid pattern: one Tab stop, arrows
 * move a day or a week, Home / End go to the week's start or end, Page Up /
 * Page Down change the month, Enter or Space select. Month and day live in
 * the URL (?month=2026-11&day=2026-11-06).
 */
export function CalendarScreen({
  sources,
  today,
  remindersLine,
}: {
  sources: DaySource[];
  today: CalendarDate;
  remindersLine: string;
}) {
  const params = useSearchParams();
  const requested = fromIsoDate(params.get("day"));
  const view =
    parseMonth(params.get("month")) ??
    (requested
      ? { year: requested.year, month: requested.month }
      : { year: today.year, month: today.month });
  const selected =
    requested && requested.year === view.year && requested.month === view.month
      ? requested
      : view.year === today.year && view.month === today.month
        ? today
        : { ...view, day: 1 };

  const tableRef = React.useRef<HTMLTableElement>(null);
  const focusAfter = React.useRef(false);

  const events = React.useMemo(
    () => monthEvents(sources, view.year, view.month, today),
    [sources, view.year, view.month, today],
  );
  const weeks = monthGrid(view.year, view.month);
  const next30 = React.useMemo(() => upcoming(sources, today, 30), [sources, today]);
  const selectedEvents = events.get(selected.day) ?? [];
  const isToday = (d: CalendarDate) => sameDate(d, today);
  const isPast = (d: CalendarDate) =>
    d.year * 10_000 + d.month * 100 + d.day < today.year * 10_000 + today.month * 100 + today.day;

  /** Moves the selection (and the month, if needed); `push` adds a history entry. */
  const go = (d: CalendarDate, { focus = false, push = false } = {}) => {
    const url = `?month=${toIsoDate(d).slice(0, 7)}&day=${toIsoDate(d)}`;
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    focusAfter.current = focus;
  };

  React.useEffect(() => {
    if (!focusAfter.current) return;
    focusAfter.current = false;
    tableRef.current?.querySelector<HTMLElement>(`[data-date="${toIsoDate(selected)}"]`)?.focus();
  });

  const onKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, () => CalendarDate> = {
      ArrowLeft: () => addDays(selected, -1),
      ArrowRight: () => addDays(selected, 1),
      ArrowUp: () => addDays(selected, -7),
      ArrowDown: () => addDays(selected, 7),
      Home: () => addDays(selected, -weekdayIndex(selected)),
      End: () => addDays(selected, 6 - weekdayIndex(selected)),
      PageUp: () => sameDayIn(addMonths(selected, -1), selected.day),
      PageDown: () => sameDayIn(addMonths(selected, 1), selected.day),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    go(move(), { focus: true });
  };

  const label = (d: CalendarDate, list: DayEvent[]) =>
    [formatFullDate(d), isToday(d) ? "today" : null, ...list.map((e) => e.title)]
      .filter(Boolean)
      .join(", ");

  const monthLabel = `${MONTHS[view.month - 1]} ${view.year}`;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section
        aria-labelledby="calendar-month"
        className="flex min-w-0 flex-col gap-3.5 rounded-[28px] bg-card p-2 shadow-card sm:p-[22px]"
      >
        <div className="flex flex-wrap items-center gap-2.5 px-2 pt-2 sm:p-0">
          <h2
            id="calendar-month"
            aria-live="polite"
            className="w-full text-24 font-extrabold tracking-[-0.02em] sm:w-auto sm:flex-1"
          >
            {MONTHS[view.month - 1]}{" "}
            <span className="font-serif font-normal text-accent-text italic">{view.year}</span>
          </h2>
          <div className="ml-auto flex gap-2">
            <Button variant="card2" onClick={() => go(today, { push: true })}>
              Today
            </Button>
            <Button
              variant="card2"
              size="icon"
              aria-label="Previous month"
              onClick={() => go(sameDayIn(addMonths(view, -1), 1), { push: true })}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <Button
              variant="card2"
              size="icon"
              aria-label="Next month"
              onClick={() => go(sameDayIn(addMonths(view, 1), 1), { push: true })}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        </div>

        <table
          ref={tableRef}
          role="grid"
          aria-label={monthLabel}
          onKeyDown={onKeyDown}
          className="w-full table-fixed border-separate border-spacing-0.5 sm:border-spacing-1.5"
        >
          <thead>
            <tr>
              {WEEKDAYS.map(([short, full]) => (
                <th
                  key={full}
                  scope="col"
                  abbr={full}
                  className="pb-1 text-left text-12 font-bold tracking-[.05em] text-sub sm:pl-2.5"
                >
                  <span aria-hidden className="hidden sm:inline">
                    {short}
                  </span>
                  <span aria-hidden className="sm:hidden">
                    {short.charAt(0)}
                  </span>
                  <span className="sr-only">{full}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, i) => (
              <tr key={i}>
                {week.map((d, j) => {
                  if (!d) return <td key={j} aria-hidden className="p-0" />;
                  const list = events.get(d.day) ?? [];
                  const sel = sameDate(d, selected);
                  const past = isPast(d);
                  return (
                    <td
                      key={toIsoDate(d)}
                      role="gridcell"
                      data-date={toIsoDate(d)}
                      tabIndex={sel ? 0 : -1}
                      aria-selected={sel}
                      aria-current={isToday(d) ? "date" : undefined}
                      onClick={() => go(d, { focus: true })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          go(d, { focus: true });
                        }
                      }}
                      className={cn(
                        "h-14 cursor-pointer rounded-[12px] p-1 align-top sm:h-[92px] sm:rounded-[16px] sm:p-2",
                        "focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid",
                        "hover-tint",
                        list.length && !past && "bg-card2",
                        sel && "ring-2 ring-accent ring-inset",
                      )}
                    >
                      <span className="sr-only">{label(d, list)}</span>
                      <span aria-hidden className="flex h-full min-w-0 flex-col items-start gap-1">
                        <span
                          className={cn(
                            "flex h-[26px] min-w-[26px] items-center justify-center rounded-pill px-1 text-13 font-bold",
                            isToday(d)
                              ? "bg-accent text-on-accent"
                              : past
                                ? "text-sub"
                                : "text-text",
                          )}
                        >
                          {d.day}
                        </span>
                        {/* Phones: dots. Wider: name tags in each person's colour. */}
                        {list.length > 0 && (
                          <span className="flex gap-0.5 pl-1 sm:hidden">
                            {list.slice(0, 3).map((e) => (
                              <span
                                key={e.key}
                                className={cn("size-1.5 rounded-full", inkBg[e.source.color])}
                              />
                            ))}
                          </span>
                        )}
                        {list.slice(0, TAGS_SHOWN).map((e) => (
                          <span
                            key={e.key}
                            className={cn(
                              "hidden max-w-full truncate rounded-[8px] px-2 py-[3px] text-12 font-bold sm:block",
                              pastelClasses[e.source.color],
                            )}
                          >
                            {e.emoji} {e.short}
                          </span>
                        ))}
                        {list.length > TAGS_SHOWN && (
                          <span className="hidden px-1 text-12 font-semibold text-sub sm:block">
                            +{list.length - TAGS_SHOWN} more
                          </span>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex min-w-0 flex-col gap-5">
        <section
          aria-labelledby="calendar-day"
          className="flex flex-col gap-3 rounded-[28px] bg-linear-160 from-peach to-card p-5 sm:p-[22px]"
        >
          <h2
            id="calendar-day"
            className="text-12 font-bold tracking-[.05em] text-peach-ink uppercase"
          >
            {isToday(selected) ? "Today · " : ""}
            {formatFullDate(selected)}
          </h2>
          {selectedEvents.length ? (
            <ul className="flex flex-col gap-3">
              {selectedEvents.map((e) => (
                <EventCard key={e.key} e={e} />
              ))}
            </ul>
          ) : (
            <NoorBubble>Nothing on this day. A quiet one ☁️</NoorBubble>
          )}
        </section>

        <section
          aria-labelledby="calendar-next"
          className="flex flex-col gap-2 rounded-[28px] bg-card p-5 shadow-card sm:p-[22px]"
        >
          <h2 id="calendar-next" className="mb-1 text-17 font-bold">
            Next 30 days
          </h2>
          {next30.length ? (
            <ul className="flex flex-col">
              {next30.map((e) => (
                <li key={e.key} className="border-t border-line first:border-t-0">
                  <button
                    type="button"
                    onClick={() => go(e.on, { push: true })}
                    className="flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-3 rounded-[12px] py-2 text-left hover-tint"
                  >
                    <span aria-hidden className="flex w-11 shrink-0 flex-col items-center">
                      <span className="text-[11px] font-bold text-sub">
                        {MONTHS[e.on.month - 1]!.slice(0, 3).toUpperCase()}
                      </span>
                      <span className="text-[20px] leading-none font-extrabold">{e.on.day}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-15 font-bold [overflow-wrap:anywhere]">
                        <span aria-hidden>{e.emoji} </span>
                        {e.title}
                      </span>
                      <span className="text-13 text-sub">
                        <span className="sr-only">{e.date}, </span>
                        {e.when}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={cn("size-2.5 shrink-0 rounded-full", inkBg[e.source.color])}
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-14 text-sub">Nothing in the next 30 days.</p>
          )}
        </section>

        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-[20px] bg-card2 px-4 py-3.5 text-14 text-sub">
          <span>
            <span aria-hidden>🔔 </span>
            {remindersLine}
          </span>
          <Link
            href="/settings"
            className="inline-flex min-h-11 items-center font-semibold whitespace-nowrap text-accent-text underline-offset-4 hover:underline"
          >
            Change
          </Link>
        </p>
      </div>
    </div>
  );
}
