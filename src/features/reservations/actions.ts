"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { reserveErrorMessage } from "./logic";

export type ReserveResult =
  { ok: true } | { ok: false; code: "taken" | "not_found" | "oops"; message: string };
export type ReservationActionResult = { ok: true } | { ok: false; message: string };

const idSchema = z.uuid();

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/log-in?next=%2Fwishlists");
  return supabase;
}

const fail = (code: "taken" | "not_found" | "oops"): ReserveResult => ({
  ok: false,
  code,
  message: reserveErrorMessage(code),
});

/**
 * Reserves a friend's wish. reserve_wish() checks the connection, the list
 * and the owner; one reservation per wish, so a race has one winner.
 */
export async function reserveWish(wishId: unknown): Promise<ReserveResult> {
  const supabase = await signedIn();
  const parsed = idSchema.safeParse(wishId);
  if (!parsed.success) return fail("not_found");
  const { error } = await supabase.rpc("reserve_wish", { p_wish_id: parsed.data });
  if (!error) return { ok: true };
  if (error.message === "already_taken") return fail("taken");
  if (error.message === "wish_not_found") return fail("not_found");
  return fail("oops");
}

/** Cancels your own reservation (RLS: only the reserver can delete it). */
export async function cancelReservation(wishId: unknown): Promise<ReservationActionResult> {
  const supabase = await signedIn();
  const parsed = idSchema.safeParse(wishId);
  if (!parsed.success) return { ok: false, message: "I couldn't find that reservation." };
  const { error } = await supabase.from("reservations").delete().eq("wish_id", parsed.data);
  if (error) return { ok: false, message: "Something went wrong on our side. Please try again." };
  return { ok: true };
}

/** Hides a quiet note (RLS: your own notes only). */
export async function dismissNotice(id: unknown): Promise<ReservationActionResult> {
  const supabase = await signedIn();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "I couldn't find that note." };
  const { error } = await supabase
    .from("notices")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data);
  if (error) return { ok: false, message: "Something went wrong on our side. Please try again." };
  return { ok: true };
}
