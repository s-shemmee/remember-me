import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { ConnectionsScreen } from "@/features/connections/components/connections-screen";
import { loadConnections } from "@/features/connections/load";
import { asPastel } from "@/features/people/view";
import { AboutYouForm } from "@/features/profile/components/about-you-form";
import { PrivacyCard } from "@/features/profile/components/privacy-card";
import { AVATARS_BUCKET } from "@/features/profile/constants";
import { AppMain } from "@/features/shell/app-shell";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My profile · Remember Me" };

/** About you and Who can see what (RLS: your own row; your photo signed for an hour). */
async function AboutYou() {
  const supabase = await createSupabaseServerClient();
  const { data: p } = await supabase
    .from("profiles")
    .select(
      "id, first_name, birthday_day, birthday_month, birth_year, avatar_kind, avatar_color, avatar_character, avatar_path, timezone, share_birthday",
    )
    .maybeSingle();
  if (!p) return null;
  let photoUrl: string | null = null;
  if (p.avatar_path) {
    const { data } = await supabase.storage
      .from(AVATARS_BUCKET)
      .createSignedUrl(p.avatar_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <AboutYouForm
        userId={p.id}
        initialPhotoUrl={photoUrl}
        initial={{
          firstName: p.first_name ?? "",
          look: {
            kind: p.avatar_kind,
            color: asPastel(p.avatar_color),
            character: p.avatar_character,
            photoPath: p.avatar_path,
          },
          birthday: { day: p.birthday_day, month: p.birthday_month, year: p.birth_year },
          timezone: p.timezone || DEFAULT_TIMEZONE,
        }}
      />
      <PrivacyCard shareBirthday={p.share_birthday} />
    </div>
  );
}

async function Connections() {
  const supabase = await createSupabaseServerClient();
  const data = await loadConnections(supabase);
  return <ConnectionsScreen {...data} />;
}

/** My profile (AppProfile): about you, who can see what, and connections. */
export default function ProfilePage() {
  return (
    <AppMain>
      <div className="flex flex-col gap-1">
        <h1 className="text-34 leading-tight font-extrabold tracking-[-0.03em]">My profile</h1>
        <p className="text-15 text-sub">How you show up for your people</p>
      </div>
      <Suspense fallback={<Card aria-busy="true" className="h-96" />}>
        <AboutYou />
      </Suspense>
      <Suspense fallback={<Card aria-busy="true" className="h-64" />}>
        <Connections />
      </Suspense>
    </AppMain>
  );
}
