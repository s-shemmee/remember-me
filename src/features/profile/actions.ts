"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { AVATARS_BUCKET } from "./constants";
import { aboutSchema, lookSchema, profileErrors, themeSchema } from "./schema";

export type ProfileResult =
  { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const OOPS = "That didn't save. Please try again.";

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/log-in?next=%2Fprofile");
  return { supabase, userId };
}

const invalid = (error: import("zod").ZodError): ProfileResult => ({
  ok: false,
  message: error.issues[0]?.message ?? "Something needs a quick look.",
  fieldErrors: profileErrors(error),
});

/** About you: names, birthday (year optional and private), city, little line, time zone. */
export async function saveAbout(input: unknown): Promise<ProfileResult> {
  const { supabase, userId } = await signedIn();
  const parsed = aboutSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: v.firstName,
      last_name: v.lastName,
      birthday_day: v.birthday.day,
      birthday_month: v.birthday.month,
      birth_year: v.birthday.year,
      city: v.city,
      bio: v.bio,
      timezone: v.timezone,
    })
    .eq("id", userId);
  return error ? { ok: false, message: OOPS } : { ok: true };
}

/**
 * Your avatar: initials, a character or a photo from your own avatars
 * folder, and a colour. A replaced photo is deleted from Storage once the
 * new look is saved.
 */
export async function saveLook(input: unknown): Promise<ProfileResult> {
  const { supabase, userId } = await signedIn();
  const parsed = lookSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const look = parsed.data;
  const photoPath = look.kind === "photo" ? look.photoPath : null;
  if (photoPath && !photoPath.startsWith(`${userId}/`)) {
    return { ok: false, message: "That photo didn't upload. Please try again." };
  }
  const { data: before } = await supabase.from("profiles").select("avatar_path").maybeSingle();
  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_kind: look.kind,
      avatar_color: look.color,
      avatar_character: look.character,
      avatar_path: photoPath,
    })
    .eq("id", userId);
  if (error) return { ok: false, message: OOPS };
  if (before?.avatar_path && before.avatar_path !== photoPath) {
    await supabase.storage.from(AVATARS_BUCKET).remove([before.avatar_path]);
  }
  return { ok: true };
}

/** "Show my birthday to my connections". */
export async function setShareBirthday(on: unknown): Promise<ProfileResult> {
  const { supabase, userId } = await signedIn();
  if (typeof on !== "boolean") return { ok: false, message: OOPS };
  const { error } = await supabase.from("profiles").update({ share_birthday: on }).eq("id", userId);
  return error ? { ok: false, message: OOPS } : { ok: true };
}

/** Appearance: light, dark or system, saved so your other devices follow. */
export async function saveTheme(choice: unknown): Promise<ProfileResult> {
  const { supabase, userId } = await signedIn();
  const parsed = themeSchema.safeParse(choice);
  if (!parsed.success) return { ok: false, message: OOPS };
  const { error } = await supabase.from("profiles").update({ theme: parsed.data }).eq("id", userId);
  return error ? { ok: false, message: OOPS } : { ok: true };
}

/** A photo uploaded in the form but never saved (Cancel, or replaced before saving). */
export async function discardAvatarUpload(path: unknown): Promise<void> {
  const { supabase, userId } = await signedIn();
  if (typeof path !== "string" || !path.startsWith(`${userId}/`)) return;
  const { data } = await supabase.from("profiles").select("avatar_path").maybeSingle();
  if (data?.avatar_path === path) return; // it's the saved one
  await supabase.storage.from(AVATARS_BUCKET).remove([path]);
}
