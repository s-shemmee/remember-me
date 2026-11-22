import "server-only";

import { characterEmoji } from "@/features/onboarding/constants";
import { asPastel } from "@/features/people/view";
import { formatShortDate } from "@/lib/dates";
import { siteOrigin } from "@/lib/site-origin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

import type { Connection, LinkablePerson, PendingInvite } from "./components/connections-screen";
import { expiresLabel } from "./invite-token";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const asDate = (iso: string) => {
  const d = new Date(iso);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};

/**
 * Your personal invite link, made the first time it's asked for (then the
 * same link every time, until "Reset link"). Null if it can't be made now
 * (the daily limit): the card says so.
 */
export async function loadInviteLink(supabase: Supabase): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_invite_link");
  if (error || !data) return null;
  return `${await siteOrigin()}/invite/${data}`;
}

/**
 * Profile → connections: your open invites for your people (not used,
 * revoked or expired; your personal link isn't one of them),
 * your connections (only the fields my_connections() allows), and your
 * people for "This is…". RLS returns only your own rows.
 */
export async function loadConnections(
  supabase: Supabase,
  now: number = Date.now(),
): Promise<{ invites: PendingInvite[]; connections: Connection[]; people: LinkablePerson[] }> {
  const [{ data: invites }, { data: connections }, { data: people }] = await Promise.all([
    supabase
      .from("invites")
      .select("id, created_at, expires_at, person:people(name)")
      .eq("kind", "once")
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date(now).toISOString())
      .order("created_at", { ascending: false }),
    supabase.rpc("my_connections"),
    supabase
      .from("people")
      .select("id, name, linked_profile_id")
      .is("archived_at", null)
      .order("name"),
  ]);

  return {
    invites: (invites ?? []).map((i) => ({
      id: i.id,
      personName: i.person?.name ?? null,
      made: `Made ${formatShortDate(asDate(i.created_at))}`,
      expires: expiresLabel(i.expires_at, now),
    })),
    connections: (connections ?? []).map((c) => ({
      id: c.connection_id,
      profileId: c.profile_id,
      name: c.first_name ?? "Someone",
      color: asPastel(c.avatar_color),
      character:
        c.avatar_kind === "character" ? (characterEmoji(c.avatar_character) ?? null) : null,
      linkedPersonId: c.linked_person_id,
      since: formatShortDate(asDate(c.connected_at)).split(", ")[1]!,
    })),
    people: (people ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      linkedProfileId: p.linked_profile_id,
    })),
  };
}
