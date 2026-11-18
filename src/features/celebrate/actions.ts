"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MAX_FUTURE_NOTE } from "./countdown";

export type CelebrateResult = { ok: true } | { ok: false; message: string };
export type SealResult = { ok: true; opensOn: string } | { ok: false; message: string };

const OOPS = "That didn't save. Please try again.";

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/log-in?next=%2Fcelebrate");
  return { supabase, userId };
}

const noteSchema = z
  .string()
  .trim()
  .min(1, { error: "Write a few words first." })
  .max(MAX_FUTURE_NOTE, { error: `Keep it under ${MAX_FUTURE_NOTE} characters.` });

/**
 * "A note to future me": sealed until your next birthday. The database
 * decides the day (your timezone) and refuses a second sealed note.
 */
export async function sealFutureNote(body: unknown): Promise<SealResult> {
  const { supabase } = await signedIn();
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? OOPS };
  const { data, error } = await supabase.rpc("seal_future_note", { p_body: parsed.data });
  if (error || !data) {
    if (error?.message === "note_sealed") {
      return { ok: false, message: "A note is already sealed. Throw it away to write a new one." };
    }
    if (error?.message === "no_birthday") {
      return { ok: false, message: "Add your birthday in your profile first." };
    }
    return { ok: false, message: OOPS };
  }
  return { ok: true, opensOn: data };
}

/** "Throw away and write a new one": deletes the sealed note, unread. */
export async function throwAwayFutureNote(): Promise<CelebrateResult> {
  const { supabase } = await signedIn();
  const { error } = await supabase.rpc("throw_away_future_note");
  return error
    ? { ok: false, message: "I couldn't throw it away. Please try again." }
    : { ok: true };
}

/** "Remind me about my own day" (off by default). */
export async function setRemindMyDay(on: unknown): Promise<CelebrateResult> {
  const { supabase, userId } = await signedIn();
  const parsed = z.boolean().safeParse(on);
  if (!parsed.success) return { ok: false, message: OOPS };
  const values = { remind_my_day: parsed.data, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("reminder_settings")
    .update(values)
    .eq("profile_id", userId)
    .select("profile_id");
  if (error) return { ok: false, message: OOPS };
  if (!data?.length) {
    const { error: insertError } = await supabase.from("reminder_settings").insert(values);
    if (insertError) return { ok: false, message: OOPS };
  }
  return { ok: true };
}
