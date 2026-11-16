import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { INVITE_COOKIE, isInviteToken } from "@/features/connections/invite-token";
import { characterEmoji } from "@/features/onboarding/constants";
import { onboardingRedirect } from "@/features/onboarding/redirect";
import { asPastel } from "@/features/people/view";
import { InstallPromptListener } from "@/features/notifications/components/install-prompt-listener";
import { ThemeSync } from "@/features/profile/components/theme-sync";
import { AVATARS_BUCKET } from "@/features/profile/constants";
import { AppShell } from "@/features/shell/app-shell";
import { parseThemeChoice } from "@/lib/theme";
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
        "onboarded_at, first_name, avatar_kind, avatar_color, avatar_character, avatar_path, birthday_day, birthday_month, timezone, theme",
      )
      .eq("id", userId)
      .maybeSingle(),
    // Removed (archived) people are never counted or shown.
    supabase.from("people").select("id", { count: "exact", head: true }).is("archived_at", null),
  ]);

  const to = onboardingRedirect("/home", Boolean(profile?.onboarded_at));
  if (to) redirect(to);

  // An invite was waiting (opened before signing up or logging in): go
  // back to it once. /invite/resume clears the cookie.
  if (isInviteToken((await cookies()).get(INVITE_COOKIE)?.value)) redirect("/invite/resume");

  const today = todayIn(profile?.timezone);
  const birthday =
    profile?.birthday_day && profile.birthday_month
      ? { day: profile.birthday_day, month: profile.birthday_month }
      : null;
  const on = birthday ? nextOccurrence(birthday, today) : null;
  let photoUrl: string | null = null;
  if (profile?.avatar_kind === "photo" && profile.avatar_path) {
    const { data } = await supabase.storage
      .from(AVATARS_BUCKET)
      .createSignedUrl(profile.avatar_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  return (
    <AppShell
      account={{
        firstName: profile?.first_name ?? "",
        color: asPastel(profile?.avatar_color),
        character:
          profile?.avatar_kind === "character"
            ? (characterEmoji(profile.avatar_character) ?? null)
            : null,
        photoUrl,
        peopleCount: count ?? 0,
      }}
      yourDay={on ? { daysUntil: daysBetween(today, on), date: formatShortDate(on) } : null}
    >
      <ThemeSync theme={parseThemeChoice(profile?.theme)} />
      {children}
    </AppShell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* The browser offers installing once, on any page: kept for Settings → App. */}
      <InstallPromptListener />
      <Suspense fallback={<div aria-busy="true" className="min-h-dvh" />}>
        <Shell>{children}</Shell>
      </Suspense>
    </>
  );
}
