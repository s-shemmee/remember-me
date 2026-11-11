import "server-only";

import { nextOccurrence, formatShortDate, todayIn } from "@/lib/dates";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

import { WISH_IMAGES_BUCKET } from "./constants";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type Wish = {
  id: string;
  wishlistId: string;
  title: string;
  url: string | null;
  price: number | null;
  currency: string;
  note: string | null;
  priority: "love" | "like" | "nice";
  imagePath: string | null;
  /** A signed URL, valid for an hour; null without an image. */
  imageUrl: string | null;
};

export type Wishlist = {
  id: string;
  kind: "birthday" | "treat" | "other";
  /** "My birthday · 22 Nov", "Treat yourself". */
  label: string;
  title: string;
  wishes: Wish[];
};

/**
 * Your two lists with their wishes (removed ones left out), in your order,
 * with signed URLs for the images (private bucket, one hour).
 */
export async function loadWishlists(supabase: Supabase) {
  const [{ data: profile }, { data: lists }, { data: wishes }] = await Promise.all([
    supabase.from("profiles").select("id, birthday_day, birthday_month, timezone").maybeSingle(),
    supabase.from("wishlists").select("id, kind, title").order("kind"),
    supabase
      .from("wishes")
      .select("id, wishlist_id, title, url, price_amount, currency, note, priority, image_path")
      .is("removed_at", null)
      .order("position")
      .order("created_at"),
  ]);

  const paths = (wishes ?? []).map((w) => w.image_path).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(WISH_IMAGES_BUCKET).createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }

  const today = todayIn(profile?.timezone);
  const birthday =
    profile?.birthday_day && profile.birthday_month
      ? formatShortDate(
          nextOccurrence({ day: profile.birthday_day, month: profile.birthday_month }, today),
        ).split(", ")[1]
      : null;

  const out: Wishlist[] = (lists ?? []).map((l) => ({
    id: l.id,
    kind: l.kind,
    title: l.title,
    label: l.kind === "birthday" && birthday ? `${l.title} · ${birthday}` : l.title,
    wishes: (wishes ?? [])
      .filter((w) => w.wishlist_id === l.id)
      .map((w) => ({
        id: w.id,
        wishlistId: w.wishlist_id,
        title: w.title,
        url: w.url,
        price: w.price_amount === null ? null : Number(w.price_amount),
        currency: w.currency,
        note: w.note,
        priority: w.priority,
        imagePath: w.image_path,
        imageUrl: w.image_path ? (signed.get(w.image_path) ?? null) : null,
      })),
  }));
  // Birthday list first.
  out.sort((a, b) => (a.kind === "birthday" ? -1 : b.kind === "birthday" ? 1 : 0));
  return { userId: profile?.id ?? null, lists: out };
}
