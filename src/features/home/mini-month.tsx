import Link from "next/link";

import { type CalendarDate, sameDate, toIsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Pastel } from "@/styles/tokens";

import { inkBg } from "../days/colors";
import { type DaySource, monthEvents, monthGrid, monthName } from "../days/days";

const WEEKDAYS = [
  ["M", "Monday"],
  ["T", "Tuesday"],
  ["W", "Wednesday"],
  ["T", "Thursday"],
  ["F", "Friday"],
  ["S", "Saturday"],
  ["S", "Sunday"],
] as const;

/**
 * Home's mini month (AppHome.dc.html): this month with a dot in each
 * person's colour on their day (up to three) and today circled. A real
 * table with a caption; each marked day says what's on it.
 */
export function MiniMonth({
  sources,
  today,
  yourColor,
}: {
  sources: DaySource[];
  today: CalendarDate;
  yourColor: Pastel | null;
}) {
  const events = monthEvents(sources, today.year, today.month, today);
  const weeks = monthGrid(today.year, today.month);
  const name = monthName(today.month);

  return (
    <section
      aria-labelledby="mini-month"
      className="flex flex-col gap-3 rounded-[28px] bg-card p-5 shadow-card sm:p-[22px]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="mini-month" className="text-17 font-bold">
          {name}
        </h2>
        <Link
          href="/calendar"
          className="inline-flex min-h-11 items-center text-13 font-semibold text-accent-text underline-offset-4 hover:underline"
        >
          Open calendar
        </Link>
      </div>
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">
          {name} {today.year}
        </caption>
        <thead>
          <tr>
            {WEEKDAYS.map(([letter, full]) => (
              <th
                key={full}
                scope="col"
                abbr={full}
                className="pb-1 text-center text-12 font-bold text-sub"
              >
                <span aria-hidden>{letter}</span>
                <span className="sr-only">{full}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>
              {week.map((d, j) => {
                if (!d) return <td key={j} />;
                const list = events.get(d.day) ?? [];
                const isToday = sameDate(d, today);
                return (
                  <td key={toIsoDate(d)} className="p-0.5 text-center">
                    <span
                      aria-current={isToday ? "date" : undefined}
                      className={cn(
                        "relative mx-auto flex size-[34px] items-center justify-center rounded-pill text-13",
                        isToday
                          ? "bg-accent font-extrabold text-on-accent"
                          : list.length
                            ? "font-bold text-text"
                            : "text-sub",
                      )}
                    >
                      {d.day}
                      {list.length > 0 && (
                        <span aria-hidden className="absolute bottom-[3px] flex gap-0.5">
                          {list.slice(0, 3).map((e) => (
                            <span
                              key={e.key}
                              className={cn(
                                "size-[5px] rounded-full",
                                isToday ? "bg-on-accent" : inkBg[e.source.color],
                              )}
                            />
                          ))}
                        </span>
                      )}
                      {(isToday || list.length > 0) && (
                        <span className="sr-only">
                          {isToday ? ", today" : ""}
                          {list.length ? `: ${list.map((e) => e.title).join(", ")}` : ""}
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
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-12 text-sub">
        <span>
          <span aria-hidden className="text-accent-text">
            ●
          </span>{" "}
          today
        </span>
        {yourColor && (
          <span>
            <span
              aria-hidden
              className={cn("inline-block size-2 rounded-full", inkBg[yourColor])}
            />{" "}
            your day
          </span>
        )}
      </p>
    </section>
  );
}
