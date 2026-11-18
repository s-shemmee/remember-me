import type { Metadata } from "next";
import { Suspense } from "react";

import { PeopleScreen } from "@/features/people/components/people-screen";
import { type PersonRow, peopleView } from "@/features/people/view";
import { AppMain } from "@/features/shell/app-shell";
import { loadPlans } from "@/features/plans/load";
import { todayIn, toIsoDate } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "People · Remember Me" };

/**
 * Your people with their days. RLS returns only your own rows; removed
 * (archived) people are left out. Countdowns use "today" in your timezone.
 */
async function People() {
  const supabase = await createSupabaseServerClient();
  // Plans: this year's and past ones (they stay on the person's profile).
  const [{ data: profile }, { data: rows }, plans] = await Promise.all([
    supabase.from("profiles").select("timezone").maybeSingle(),
    supabase
      .from("people")
      .select(
        "id, name, relation, relation_kind, color, group, little_things, linked_profile_id, in_memory, occasions(id, kind, title, day, month, year, recurring)",
      )
      .is("archived_at", null)
      .order("created_at"),
    loadPlans(supabase),
  ]);
  const today = todayIn(profile?.timezone);
  const people = peopleView((rows ?? []) as PersonRow[], today);
  return <PeopleScreen people={people} plans={plans} today={toIsoDate(today)} />;
}

export default function PeoplePage() {
  return (
    <AppMain>
      <Suspense
        fallback={
          <>
            <h1 className="text-34 leading-tight font-extrabold tracking-[-0.03em]">People</h1>
            <div aria-busy="true" className="h-48 rounded-card bg-card shadow-card" />
          </>
        }
      >
        <People />
      </Suspense>
    </AppMain>
  );
}
