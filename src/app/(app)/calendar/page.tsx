import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { CalendarScreen } from "@/features/calendar/calendar-screen";
import { remindersLine } from "@/features/days/days";
import { loadDays } from "@/features/days/load";
import { AddPersonButton } from "@/features/people/components/add-person-button";
import { AppMain } from "@/features/shell/app-shell";
import { PageHeader, PageHeaderFallback } from "@/features/shell/page-header";
import { notificationsInboxEnabled } from "@/lib/flags";
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

/** Its own Suspense: the bell switch is read per request. */
async function CalendarHeader() {
  await connection();
  return (
    <PageHeader
      title="Calendar"
      subtitle="Every day worth remembering, in one place"
      primary={<AddPersonButton compact />}
      bell={notificationsInboxEnabled()}
    />
  );
}

export default function CalendarPage() {
  return (
    <AppMain>
      <Suspense fallback={<PageHeaderFallback title="Calendar" />}>
        <CalendarHeader />
      </Suspense>
      <Suspense fallback={<Card aria-busy="true" className="h-[480px]" />}>
        <Calendar />
      </Suspense>
    </AppMain>
  );
}
