"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { RELATION_COLORS } from "./constants";
import { onboardingError } from "./errors";
import { fieldErrors, onboardingSchema } from "./schema";

export type CompleteOnboardingResult =
  | { ok: true; personName: string | null }
  | { ok: false; step: number; message: string; fieldErrors?: Record<string, string> };

/**
 * Saves the whole onboarding in one call: checks the user, validates the
 * draft with Zod, then calls complete_onboarding() (one transaction, RLS
 * applies). Error codes from the database become friendly copy.
 */
export async function completeOnboarding(input: unknown): Promise<CompleteOnboardingResult> {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/log-in?next=%2Fonboarding");

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const section = String(first?.path[0] ?? "you");
    const step = ["you", "look", "person", "reminders"].indexOf(section);
    return {
      ok: false,
      step: step === -1 ? 0 : step,
      message: first?.message ?? "Something needs a quick look.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { you, look, person, reminders, timezone } = parsed.data;
  const withPerson = !person.skipped;

  const { error } = await supabase.rpc("complete_onboarding", {
    p_first_name: you.firstName,
    p_birthday_day: you.day!,
    p_birthday_month: you.month!,
    p_birth_year: you.year ?? undefined,
    p_avatar_kind: look.kind,
    p_avatar_color: look.color,
    p_avatar_character: look.kind === "character" ? (look.character ?? undefined) : undefined,
    p_person_name: withPerson ? person.name : undefined,
    p_person_relation: withPerson ? person.relation : undefined,
    p_person_color: withPerson ? RELATION_COLORS[person.relation] : undefined,
    p_person_birthday_day: withPerson ? (person.day ?? undefined) : undefined,
    p_person_birthday_month: withPerson ? (person.month ?? undefined) : undefined,
    p_person_birthday_year: withPerson ? (person.year ?? undefined) : undefined,
    p_person_little_thing: withPerson && person.littleThing ? person.littleThing : undefined,
    p_reminder_offsets: reminders.offsets,
    p_reminder_email: reminders.email,
    p_reminder_push: reminders.push,
    p_timezone: timezone ?? undefined,
  });

  if (error) {
    const info = onboardingError(error.message);
    if (info.kind === "already_onboarded") redirect("/home");
    if (info.kind === "signed_out") redirect("/log-in?next=%2Fonboarding");
    if (info.kind === "step") return { ok: false, step: info.step, message: info.message };
    return { ok: false, step: 3, message: info.message };
  }

  return { ok: true, personName: withPerson ? person.name : null };
}
