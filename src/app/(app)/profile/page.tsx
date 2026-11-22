import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { ConnectedCard, InviteCard } from "@/features/connections/components/connections-screen";
import { loadConnections, loadInviteLink } from "@/features/connections/load";
import { asPastel } from "@/features/people/view";
import { AboutYouForm } from "@/features/profile/components/about-you-form";
import { AvatarEditor } from "@/features/profile/components/avatar-editor";
import { ProfileStats, WhoSeesWhat } from "@/features/profile/components/profile-cards";
import { MeLinks } from "@/features/profile/components/me-links";
import { AVATARS_BUCKET } from "@/features/profile/constants";
import { AppMain } from "@/features/shell/app-shell";
import { PageHeader, PageHeaderFallback } from "@/features/shell/page-header";
import {
  countdownLabel,
  DEFAULT_TIMEZONE,
  daysBetween,
  formatDayMonth,
  nextOccurrence,
  todayIn,
} from "@/lib/dates";
import { notificationsInboxEnabled } from "@/lib/flags";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My profile · Remember Me" };

/**
 * My profile (docs/design/DESIGN.md). From 1024px, two columns: left (1/3)
 * your card (avatar + edit, name, "@handle · City", birthday pill, little
 * line, three numbers) and "Invite your people"; right (2/3) About you, Who
 * can see what (a summary; the switch is in Settings → Privacy) and
 * Connected with you. Narrower: one column, same order.
 * RLS: your own rows; your photo is signed for an hour.
 */
async function Profile() {
  const supabase = await createSupabaseServerClient();
  const [{ data: p }, people, wishlists, days, connections, inviteLink] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, first_name, last_name, handle, city, bio, birthday_day, birthday_month, birth_year, avatar_kind, avatar_color, avatar_character, avatar_path, timezone, share_birthday",
      )
      .maybeSingle(),
    supabase.from("people").select("id", { count: "exact", head: true }).is("archived_at", null),
    // Your lists and the ones your connections share with you.
    supabase.from("wishlists").select("id", { count: "exact", head: true }),
    // Every day you keep for your people (removed people's days don't count).
    supabase
      .from("occasions")
      .select("id, people!inner(archived_at)", { count: "exact", head: true })
      .is("people.archived_at", null),
    loadConnections(supabase),
    // Your personal link: made the first time, the same link after that.
    loadInviteLink(supabase),
  ]);
  if (!p) return null;

  let photoUrl: string | null = null;
  if (p.avatar_path) {
    const { data } = await supabase.storage
      .from(AVATARS_BUCKET)
      .createSignedUrl(p.avatar_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }
  const timezone = p.timezone || DEFAULT_TIMEZONE;
  const fullName = [p.first_name, p.last_name].filter(Boolean).join(" ") || "You";
  const handleLine = [p.handle ? `@${p.handle}` : null, p.city].filter(Boolean).join(" · ");
  const birthday =
    p.birthday_day && p.birthday_month ? { day: p.birthday_day, month: p.birthday_month } : null;
  const today = todayIn(timezone);
  const birthdayLine = birthday
    ? `${formatDayMonth(birthday)} · ${countdownLabel(daysBetween(today, nextOccurrence(birthday, today)))}`
    : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      {/* Left: your card and Invite your people. */}
      <div className="flex min-w-0 flex-col gap-6">
        <section
          aria-label="Your profile"
          className="flex flex-col items-center gap-3 rounded-card-lg bg-[linear-gradient(160deg,var(--rose),var(--rose2))] p-6 text-center text-text shadow-card sm:p-8"
        >
          <AvatarEditor
            userId={p.id}
            name={p.first_name ?? "You"}
            initialPhotoUrl={photoUrl}
            initial={{
              kind: p.avatar_kind,
              color: asPastel(p.avatar_color),
              character: p.avatar_character,
              photoPath: p.avatar_path,
            }}
          />
          <div className="flex min-w-0 flex-col items-center gap-1">
            <h2 className="text-22 font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere]">
              {fullName}
            </h2>
            {handleLine && (
              <p className="text-15 font-medium [overflow-wrap:anywhere] text-rose-ink">
                {handleLine}
              </p>
            )}
          </div>
          {birthdayLine && (
            <p className="rounded-pill bg-card px-3.5 py-1.5 text-14 font-bold">
              <span aria-hidden="true">🎂 </span>
              {birthdayLine}
            </p>
          )}
          {p.bio && (
            <p className="font-hand text-[19px] [overflow-wrap:anywhere]">&ldquo;{p.bio}&rdquo;</p>
          )}
          <ProfileStats
            people={people.count ?? 0}
            wishlists={wishlists.count ?? 0}
            days={days.count ?? 0}
          />
        </section>
        <InviteCard link={inviteLink} invites={connections.invites} />
      </div>

      {/* Right: About you, Who can see what, Connected with you. */}
      <div className="flex min-w-0 flex-col gap-6">
        <AboutYouForm
          initial={{
            firstName: p.first_name ?? "",
            lastName: p.last_name ?? "",
            birthday: { day: p.birthday_day, month: p.birthday_month, year: p.birth_year },
            city: p.city ?? "",
            bio: p.bio ?? "",
            timezone,
          }}
        />
        <WhoSeesWhat shareBirthday={p.share_birthday} />
        <ConnectedCard connections={connections.connections} people={connections.people} />
        <MeLinks />
      </div>
    </div>
  );
}

async function Header() {
  // The bell switch is read per request, after the session.
  await createSupabaseServerClient();
  return (
    <PageHeader
      title="My profile"
      subtitle="How you show up for your people"
      theme={false}
      bell={notificationsInboxEnabled()}
    />
  );
}

export default function ProfilePage() {
  return (
    <AppMain>
      <Suspense fallback={<PageHeaderFallback title="My profile" />}>
        <Header />
      </Suspense>
      <Suspense fallback={<Card aria-busy="true" className="h-96" />}>
        <Profile />
      </Suspense>
    </AppMain>
  );
}
