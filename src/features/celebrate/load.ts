import "server-only";

import { loadPlans } from "@/features/plans/load";
import type { PlanView } from "@/features/plans/steps";
import { loadWishlists, type Wishlist } from "@/features/wishes/load";
import { type CalendarDate, todayIn } from "@/lib/dates";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

import { countdown, type Countdown } from "./countdown";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type CelebrateData = {
  firstName: string;
  today: CalendarDate;
  /** Null until you add your birthday in Profile. */
  countdown: Countdown | null;
  /** Your own plans (this year's is the one for `countdown.occursOn`). */
  plans: PlanView[];
  birthdayList: Wishlist | null;
  treatList: Wishlist | null;
  remindMyDay: boolean;
  /** A sealed note waiting: only when it opens, never its words. */
  sealedNote: { opensOn: string } | null;
  /** The newest note you can read (RLS: only from its day on). */
  openedNote: { opensOn: string; body: string } | null;
};

/** Everything Celebrate Me shows. RLS returns only your own rows. */
export async function loadCelebrate(supabase: Supabase): Promise<CelebrateData> {
  const [
    { data: profile },
    { lists },
    { data: settings },
    { data: sealed },
    { data: opened },
    plans,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, birthday_day, birthday_month, birth_year, timezone")
      .maybeSingle(),
    loadWishlists(supabase),
    supabase.from("reminder_settings").select("remind_my_day").maybeSingle(),
    supabase.rpc("my_sealed_note"),
    supabase
      .from("future_notes")
      .select("opens_on, body")
      .order("opens_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Your own-day plans (a few at most: one a year).
    loadPlans(supabase, { ownDayOnly: true }),
  ]);
  const today = todayIn(profile?.timezone);
  const c =
    profile?.birthday_day && profile.birthday_month
      ? countdown(
          { day: profile.birthday_day, month: profile.birthday_month },
          today,
          profile.birth_year,
        )
      : null;
  const note = sealed?.[0];
  return {
    firstName: profile?.first_name ?? "",
    today,
    countdown: c,
    plans,
    birthdayList: lists.find((l) => l.kind === "birthday") ?? null,
    treatList: lists.find((l) => l.kind === "treat") ?? null,
    remindMyDay: settings?.remind_my_day ?? false,
    sealedNote: note ? { opensOn: note.opens_on } : null,
    openedNote: opened ? { opensOn: opened.opens_on, body: opened.body } : null,
  };
}
