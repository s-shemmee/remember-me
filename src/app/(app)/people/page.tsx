import type { Metadata } from "next";
import { Suspense } from "react";

import { giftIdeasEnabled, messagesEnabled } from "@/ai/config";
import { PeopleScreen } from "@/features/people/components/people-screen";
import type { PersonWishlist } from "@/features/people/components/person-panel";
import { loadFriends } from "@/features/reservations/load";
import { type PersonRow, peopleView } from "@/features/people/view";
import { AppMain } from "@/features/shell/app-shell";
import { PageHeaderFallback } from "@/features/shell/page-header";
import { loadPlans } from "@/features/plans/load";
import { todayIn, toIsoDate } from "@/lib/dates";
import { notificationsInboxEnabled } from "@/lib/flags";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { looksByPerson } from "@/features/people/looks";

export const metadata: Metadata = { title: "People · Remember Me" };

/**
 * Your people with their days. RLS returns only your own rows; removed
 * (archived) people are left out. Countdowns use "today" in your timezone.
 */
async function People() {
  const supabase = await createSupabaseServerClient();
  // Plans: this year's and past ones (they stay on the person's profile).
  const [{ data: profile }, { data: rows }, plans, { friends }] = await Promise.all([
    supabase.from("profiles").select("timezone").maybeSingle(),
    supabase
      .from("people")
      .select(
        "id, name, relation, relation_kind, color, group, little_things, little_thing_emojis, linked_profile_id, in_memory, occasions(id, kind, title, day, month, year, recurring)",
      )
      .is("archived_at", null)
      .order("created_at"),
    loadPlans(supabase),
    // Connected friends' shared lists, as you see them (free, yours, taken; never by whom).
    loadFriends(supabase),
  ]);
  const wishlists: Record<string, PersonWishlist> = {};
  for (const f of friends) {
    if (f.linkedPersonId) wishlists[f.linkedPersonId] = { friendId: f.profileId, wishes: f.wishes };
  }
  const today = todayIn(profile?.timezone);
  // Connected people show their own photo or character; everything else stays yours.
  const looks = looksByPerson(friends);
  const people = peopleView((rows ?? []) as PersonRow[], today).map((p) => ({
    ...p,
    look: looks.get(p.id) ?? null,
  }));
  return (
    <PeopleScreen
      people={people}
      plans={plans}
      today={toIsoDate(today)}
      giftIdeas={giftIdeasEnabled()}
      bell={notificationsInboxEnabled()}
      wishlists={wishlists}
      messages={messagesEnabled()}
    />
  );
}

export default function PeoplePage() {
  return (
    <AppMain>
      <Suspense
        fallback={
          <>
            <PageHeaderFallback title="People" />
            <div aria-busy="true" className="h-48 rounded-card bg-card shadow-card" />
          </>
        }
      >
        <People />
      </Suspense>
    </AppMain>
  );
}
