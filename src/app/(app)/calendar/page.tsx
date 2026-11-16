import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { SavedThemeToggle } from "@/features/profile/components/saved-theme-toggle";
import { CalendarScreen } from "@/features/calendar/calendar-screen";
import { remindersLine } from "@/features/days/days";
import { loadDays } from "@/features/days/load";
import { AddPersonButton } from "@/features/people/components/add-person-button";
import { AppMain } from "@/features/shell/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Calendar · Remember Me" };

async function Calendar() {
  const supabase = await createSupabaseServerClient();
  const { sources, today, reminderOffsets } = await loadDays(supabase);
  return (
    <CalendarScreen
      sources={sources}
      today={today}
      remindersLine={remindersLine(reminderOffsets)}
    />
  );
}

export default function CalendarPage() {
  return (
    <AppMain>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <h1 className="text-34 leading-tight font-extrabold tracking-[-0.03em]">Calendar</h1>
          <p className="text-15 text-sub">Every day worth remembering, in one place</p>
        </div>
        <SavedThemeToggle />
        <AddPersonButton />
      </div>
      <Suspense fallback={<Card aria-busy="true" className="h-[480px]" />}>
        <Calendar />
      </Suspense>
    </AppMain>
  );
}
