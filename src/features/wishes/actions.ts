"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { WISH_IMAGES_BUCKET } from "./constants";
import { wishFieldErrors, wishFormSchema } from "./schema";

export type SaveWishResult =
  | { ok: true; id: string; title: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };
export type WishActionResult = { ok: true } | { ok: false; message: string };

const OOPS = "Something went wrong on our side. Please try again.";
const idSchema = z.uuid();

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/log-in?next=%2Fwishlists");
  return { supabase, userId };
}

/**
 * Adds or edits a wish: checks the user, validates with Zod, then writes as
 * the user (RLS: your own lists, images from your own folder). A replaced
 * or removed image is deleted from Storage.
 */
export async function saveWish(input: unknown): Promise<SaveWishResult> {
  const { supabase, userId } = await signedIn();
  const parsed = wishFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Something needs a quick look.",
      fieldErrors: wishFieldErrors(parsed.error),
    };
  }
  const w = parsed.data;
  if (w.imagePath && !w.imagePath.startsWith(`${userId}/`)) {
    return { ok: false, message: "That photo didn't upload. Please try again." };
  }
  const values = {
    wishlist_id: w.wishlistId,
    title: w.title,
    url: w.url,
    price_amount: w.price,
    currency: w.currency,
    note: w.note || null,
    priority: w.priority,
    image_path: w.imagePath,
  };

  if (!w.id) {
    const { data: last } = await supabase
      .from("wishes")
      .select("position")
      .eq("wishlist_id", w.wishlistId)
      .is("removed_at", null)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await supabase
      .from("wishes")
      .insert({ ...values, position: (last?.position ?? 0) + 1 })
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: OOPS };
    return { ok: true, id: data.id, title: w.title };
  }

  const { data: before } = await supabase
    .from("wishes")
    .select("image_path")
    .eq("id", w.id)
    .is("removed_at", null)
    .maybeSingle();
  if (!before)
    return { ok: false, message: "I couldn't find that wish. It may have been removed." };
  const { error } = await supabase.from("wishes").update(values).eq("id", w.id);
  if (error) return { ok: false, message: OOPS };
  if (before.image_path && before.image_path !== w.imagePath) {
    await supabase.storage.from(WISH_IMAGES_BUCKET).remove([before.image_path]);
  }
  return { ok: true, id: w.id, title: w.title };
}

/** Removes a wish (Undo brings it back); its image stays until the M4 clean-up. */
export async function removeWish(id: unknown): Promise<WishActionResult> {
  return setRemoved(id, true);
}

export async function restoreWish(id: unknown): Promise<WishActionResult> {
  return setRemoved(id, false);
}

async function setRemoved(id: unknown, removed: boolean): Promise<WishActionResult> {
  const { supabase } = await signedIn();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "I couldn't find that wish." };
  const query = supabase
    .from("wishes")
    .update({ removed_at: removed ? new Date().toISOString() : null })
    .eq("id", parsed.data);
  const { data, error } = await (
    removed ? query.is("removed_at", null) : query.not("removed_at", "is", null)
  ).select("id");
  if (error) return { ok: false, message: OOPS };
  if (!data?.length) return { ok: false, message: "I couldn't find that wish." };
  return { ok: true };
}

const orderSchema = z.object({ wishlistId: z.uuid(), ids: z.array(z.uuid()).max(500) });

/** Saves a list's new order (one transaction, your own list only). */
export async function reorderWishes(input: unknown): Promise<WishActionResult> {
  const { supabase } = await signedIn();
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That order didn't work. Please try again." };
  const { error } = await supabase.rpc("reorder_wishes", {
    p_wishlist_id: parsed.data.wishlistId,
    p_ids: parsed.data.ids,
  });
  if (error) return { ok: false, message: "That order didn't work. Please refresh and try again." };
  return { ok: true };
}

/** Deletes a photo uploaded in the dialog but never saved (dialog closed). */
export async function discardUpload(path: unknown): Promise<void> {
  const { supabase, userId } = await signedIn();
  if (typeof path !== "string" || !path.startsWith(`${userId}/`)) return;
  const { data } = await supabase.from("wishes").select("id").eq("image_path", path).limit(1);
  if (data?.length) return; // used by a wish: keep it
  await supabase.storage.from(WISH_IMAGES_BUCKET).remove([path]);
}
