import "server-only";

import { asPastel } from "@/features/people/view";
import { type CalendarDate, hourIn, todayIn } from "@/lib/dates";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

import type { DayKind, DaySource } from "./days";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type DaysData = {
  sources: DaySource[];
  firstName: string;
  peopleCount: number;
  today: CalendarDate;
  hour: number;
  reminderOffsets: number[];
};

/**
 * Everything Home and Calendar need, in one round trip: your profile, your
 * people (removed ones left out) with their days, and your reminder
 * settings. RLS returns only your own rows. "Today" is in your timezone.
 */
export async function loadDays(supabase: Supabase): Promise<DaysData> {
  const [{ data: profile }, { data: people }, { data: reminders }] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, birthday_day, birthday_month, avatar_color, timezone")
      .maybeSingle(),
    supabase
      .from("people")
      .select("id, name, color, little_things, occasions(id, kind, title, day, month, year)")
      .is("archived_at", null)
      .order("created_at"),
    supabase.from("reminder_settings").select("offsets_days").maybeSingle(),
  ]);

  const sources: DaySource[] = [];
  for (const p of people ?? []) {
    for (const o of p.occasions) {
      sources.push({
        id: o.id,
        personId: p.id,
        name: p.name,
        isYou: false,
        kind: o.kind as DayKind,
        title: o.title,
        day: o.day,
        month: o.month,
        year: o.year,
        color: asPastel(p.color),
        littleThings: p.little_things,
      });
    }
  }
  const firstName = profile?.first_name ?? "";
  if (profile?.birthday_day && profile.birthday_month) {
    // Your birth year stays private: it's never needed here.
    sources.push({
      id: "you",
      personId: null,
      name: firstName || "You",
      isYou: true,
      kind: "birthday",
      title: null,
      day: profile.birthday_day,
      month: profile.birthday_month,
      year: null,
      color: asPastel(profile.avatar_color ?? "rose"),
      littleThings: [],
    });
  }

  return {
    sources,
    firstName,
    peopleCount: people?.length ?? 0,
    today: todayIn(profile?.timezone),
    hour: hourIn(profile?.timezone),
    reminderOffsets: reminders?.offsets_days ?? [7, 1, 0],
  };
}
