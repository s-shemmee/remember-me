import "server-only";

import { characterEmoji } from "@/features/onboarding/constants";
import { asPastel } from "@/features/people/view";
import { AVATARS_BUCKET } from "@/features/profile/constants";
import { WISH_IMAGES_BUCKET } from "@/features/wishes/constants";
import { isRealDayMonth, todayIn } from "@/lib/dates";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  type Friend,
  friendDaysUntil,
  type FriendWish,
  type Notice,
  noticeText,
  sortFriends,
  type WishStatus,
} from "./logic";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const asStatus = (s: string): WishStatus => (s === "mine" || s === "taken" ? s : "free");

/**
 * Friends' wishlists: your connections (my_friends(): first name, look,
 * birthday day and month), their shared wishes with a free / mine / taken
 * status (friend_wishes(): never your own wishes, never who reserved), and
 * your unread notes. Photos are signed with your session; Storage only
 * allows it for wishes you can see.
 */
export async function loadFriends(
  supabase: Supabase,
): Promise<{ friends: Friend[]; notices: Notice[] }> {
  const [
    { data: profile },
    { data: friends },
    { data: wishes },
    { data: notices },
    { data: gone },
  ] = await Promise.all([
    supabase.from("profiles").select("timezone").maybeSingle(),
    supabase.rpc("my_friends"),
    supabase.rpc("friend_wishes"),
    supabase
      .from("notices")
      .select("id, actor_name")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    // Your people marked "In memory" (RLS: your own).
    supabase.from("people").select("id").eq("in_memory", true).is("archived_at", null),
  ]);
  const inMemory = new Set((gone ?? []).map((p) => p.id));

  // Friends' photos: signed with your session; Storage allows it only for
  // a connection's current avatar (can_view_avatar).
  const avatarPaths = (friends ?? [])
    .map((f) => f.avatar_path)
    .filter((p): p is string => Boolean(p));
  const avatars = new Map<string, string>();
  if (avatarPaths.length) {
    const { data } = await supabase.storage
      .from(AVATARS_BUCKET)
      .createSignedUrls(avatarPaths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) avatars.set(s.path, s.signedUrl);
  }

  const paths = (wishes ?? []).map((w) => w.image_path).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(WISH_IMAGES_BUCKET).createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }

  const byOwner = new Map<string, FriendWish[]>();
  for (const w of wishes ?? []) {
    const list = byOwner.get(w.owner_id) ?? [];
    list.push({
      id: w.id,
      title: w.title,
      url: w.url,
      price: w.price_amount === null ? null : Number(w.price_amount),
      currency: w.currency,
      note: w.note,
      priority: w.priority,
      imageUrl: w.image_path ? (signed.get(w.image_path) ?? null) : null,
      status: asStatus(w.status),
    });
    byOwner.set(w.owner_id, list);
  }

  const today = todayIn(profile?.timezone);
  return {
    friends: sortFriends(
      (friends ?? []).map((f) => {
        const birthday =
          f.birthday_day && f.birthday_month && isRealDayMonth(f.birthday_day, f.birthday_month)
            ? { day: f.birthday_day, month: f.birthday_month }
            : null;
        return {
          profileId: f.profile_id,
          name: f.name ?? f.first_name ?? "Someone",
          firstName: f.first_name ?? f.name ?? "Someone",
          pastel: asPastel(f.avatar_color),
          character:
            f.avatar_kind === "character" ? (characterEmoji(f.avatar_character) ?? null) : null,
          birthday,
          daysUntil: friendDaysUntil(birthday, today),
          linkedPersonId: f.linked_person_id,
          inMemory: f.linked_person_id ? inMemory.has(f.linked_person_id) : false,
          photoUrl: f.avatar_path ? (avatars.get(f.avatar_path) ?? null) : null,
          wishes: byOwner.get(f.profile_id) ?? [],
        };
      }),
    ),
    notices: (notices ?? []).map((n) => ({ id: n.id, text: noticeText(n.actor_name) })),
  };
}
