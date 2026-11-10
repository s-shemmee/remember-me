import { redirect } from "next/navigation";
import { Suspense } from "react";

import { characterEmoji } from "@/features/onboarding/constants";
import { onboardingRedirect } from "@/features/onboarding/redirect";
import { asPastel } from "@/features/people/view";
import { AppShell } from "@/features/shell/app-shell";
import { daysBetween, formatShortDate, nextOccurrence, todayIn } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Every app page (home, people, calendar…) needs a finished onboarding and
 * sits in the app shell. The proxy has already checked the session; this
 * reads the profile (by primary key) and counts your people, sends
 * unfinished people to /onboarding, and fills the sidebar.
 */
async function Shell({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/log-in");

  const [{ data: profile }, { count }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "onboarded_at, first_name, avatar_kind, avatar_color, avatar_character, birthday_day, birthday_month, timezone",
      )
      .eq("id", userId)
      .maybeSingle(),
    // Removed (archived) people are never counted or shown.
    supabase.from("people").select("id", { count: "exact", head: true }).is("archived_at", null),
  ]);

  const to = onboardingRedirect("/home", Boolean(profile?.onboarded_at));
  if (to) redirect(to);

  const today = todayIn(profile?.timezone);
  const birthday =
    profile?.birthday_day && profile.birthday_month
      ? { day: profile.birthday_day, month: profile.birthday_month }
      : null;
  const on = birthday ? nextOccurrence(birthday, today) : null;

  return (
    <AppShell
      account={{
        firstName: profile?.first_name ?? "",
        color: asPastel(profile?.avatar_color),
        character:
          profile?.avatar_kind === "character"
            ? (characterEmoji(profile.avatar_character) ?? null)
            : null,
        peopleCount: count ?? 0,
      }}
      yourDay={on ? { daysUntil: daysBetween(today, on), date: formatShortDate(on) } : null}
    >
      {children}
    </AppShell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-dvh" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
