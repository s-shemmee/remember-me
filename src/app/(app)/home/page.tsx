import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pastelClasses } from "@/components/ui/chip";
import { Noor } from "@/components/ui/noor";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TruncatedName } from "@/components/ui/truncated-name";
import {
  greeting,
  monthName,
  moreThisMonth,
  nextUp,
  nextUpLine,
  noorNudge,
  upcoming,
  weekSummary,
} from "@/features/days/days";
import { loadDays } from "@/features/days/load";
import { ComingUp } from "@/features/home/coming-up";
import { MiniMonth } from "@/features/home/mini-month";
import { AddPersonButton } from "@/features/people/components/add-person-button";
import { AppMain } from "@/features/shell/app-shell";
import { formatFullDate } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Pastel } from "@/styles/tokens";

export const metadata: Metadata = { title: "Home · Remember Me" };

function StatCard({
  label,
  emoji,
  value,
  line,
  pastel,
}: {
  label: string;
  emoji: string;
  value: React.ReactNode;
  line: string;
  pastel: Pastel;
}) {
  return (
    <li
      className={cn(
        "flex min-h-[128px] min-w-0 flex-col gap-1.5 rounded-card px-5 py-[18px]",
        pastelClasses[pastel],
      )}
    >
      <span className="flex items-center justify-between gap-2 text-12 font-bold tracking-[.05em]">
        <span>{label}</span>
        <span aria-hidden className="text-[18px]">
          {emoji}
        </span>
      </span>
      <span className="truncate text-[28px] leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-[30px]">
        {value}
      </span>
      <span className="text-13 font-medium">{line}</span>
    </li>
  );
}

async function Dashboard() {
  const supabase = await createSupabaseServerClient();
  const data = await loadDays(supabase);
  const { sources, today, firstName, peopleCount } = data;

  const events = upcoming(sources, today);
  const peopleEvents = events.filter((e) => !e.source.isYou);
  const you = sources.find((s) => s.isYou) ?? null;
  const yourDay = events.find((e) => e.source.isYou) ?? null;
  // Next up is celebratory, so days of remembrance never take it.
  const next = nextUp(peopleEvents);
  const more = moreThisMonth(sources, today);
  const nudge = noorNudge(events, peopleCount > 0, firstName);
  const greet = greeting(data.hour);
  const month = monthName(today.month);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <h1 className="text-34 leading-tight font-extrabold tracking-[-0.03em]">
            {greet.text}
            {firstName && (
              <>
                ,{" "}
                <TruncatedName className="font-serif font-normal text-accent-text italic">
                  {firstName}
                </TruncatedName>
              </>
            )}{" "}
            <span aria-hidden>{greet.emoji}</span>
          </h1>
          <p className="text-15 text-sub">
            {formatFullDate(today)} · {weekSummary(events)}
          </p>
        </div>
        {peopleCount > 0 && (
          <Form
            action="/people"
            role="search"
            className="relative min-w-0 flex-[1_1_220px] sm:max-w-[280px]"
          >
            <label htmlFor="home-search" className="sr-only">
              Search people
            </label>
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-sub"
            />
            <input
              id="home-search"
              name="q"
              type="search"
              placeholder="Search people…"
              autoComplete="off"
              className="min-h-11 w-full rounded-pill border-[1.5px] border-line bg-card pr-4 pl-11 text-15 text-text placeholder:text-sub focus:border-accent focus:outline-none"
            />
          </Form>
        )}
        <ThemeToggle />
        <AddPersonButton />
      </div>

      {/* Noor's nudge (template text; "Reserve it" waits for wishlists, M3). */}
      <section
        aria-label="Noor"
        className="flex flex-wrap items-end gap-3.5 rounded-[28px] bg-linear-160 from-peach to-card px-5 py-5 sm:px-6"
      >
        <Noor size={58} mood="smiling" animated className="shrink-0" />
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
          <span className="pl-2.5 text-12 font-semibold text-sub">Noor · now</span>
          <p className="self-start rounded-[22px_22px_22px_6px] bg-card px-4 py-3 font-system text-16 leading-[1.4] [overflow-wrap:anywhere] shadow-card">
            {nudge.text}
          </p>
        </div>
        {nudge.personId ? (
          <Button asChild variant="card2" className="bg-card">
            <Link href={`/people?person=${nudge.personId}`}>
              <span className="max-w-[20ch] truncate">Open {nudge.name}</span>
            </Link>
          </Button>
        ) : nudge.isYou ? (
          <Button asChild variant="card2" className="bg-card">
            <Link href="/celebrate">Open Celebrate Me</Link>
          </Button>
        ) : null}
      </section>

      <ul aria-label="At a glance" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="NEXT UP"
          emoji={next?.emoji ?? "🎂"}
          value={next ? next.source.name : peopleCount ? "All quiet" : "No one yet"}
          line={
            next ? nextUpLine(next) : peopleCount ? "nothing coming up" : "add your first person"
          }
          pastel={next?.source.color ?? "butter"}
        />
        <StatCard
          label="THIS MONTH"
          emoji="🗓️"
          value={more ? String(more) : "None"}
          line={
            more
              ? `more ${more === 1 ? "day" : "days"} to celebrate in ${month}`
              : `left to celebrate in ${month}`
          }
          pastel="sky"
        />
        <StatCard
          label="YOUR DAY"
          emoji="🕯️"
          value={
            !yourDay
              ? "Not set"
              : yourDay.daysUntil === 0
                ? "Today"
                : yourDay.daysUntil === 1
                  ? "Tomorrow"
                  : `${yourDay.daysUntil} days`
          }
          line={yourDay ? `${formatFullDate(yourDay.on)} ✨` : "add it in your profile"}
          pastel={you?.color ?? "rose"}
        />
        <StatCard
          label="YOUR PEOPLE"
          emoji="💛"
          value={String(peopleCount)}
          line={
            peopleCount
              ? `${peopleCount === 1 ? "person" : "people"} you remember`
              : "add someone to begin"
          }
          pastel="mint"
        />
      </ul>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        {peopleCount ? (
          <ComingUp events={peopleEvents} />
        ) : (
          <section
            aria-labelledby="coming-up"
            className="flex flex-col items-start gap-4 rounded-[28px] bg-card p-6 shadow-card"
          >
            <h2 id="coming-up" className="text-22 font-extrabold tracking-[-0.02em]">
              Coming up
            </h2>
            <p className="text-15 text-sub">
              No one here yet. Add someone and their birthdays and special days show up here.
            </p>
            <AddPersonButton />
          </section>
        )}
        <MiniMonth sources={sources} today={today} yourColor={you?.color ?? null} />
      </div>
    </>
  );
}

export default function HomePage() {
  return (
    <AppMain>
      <Suspense
        fallback={
          <>
            <h1 className="text-34 leading-tight font-extrabold tracking-[-0.03em]">Home</h1>
            <Card aria-busy="true" className="h-40" />
          </>
        }
      >
        <Dashboard />
      </Suspense>
    </AppMain>
  );
}
