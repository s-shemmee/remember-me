"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { personError } from "./errors";
import { personFieldErrors, personFormSchema } from "./schema";

export type SavePersonResult =
  | { ok: true; id: string; name: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export type PersonActionResult = { ok: true } | { ok: false; message: string };

const idSchema = z.uuid();

async function signedInClient(next: string) {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect(`/log-in?next=${encodeURIComponent(next)}`);
  return supabase;
}

/**
 * Adds (id null) or edits one of your people with their birthday, other days
 * and little things: checks the user, validates with Zod, then calls
 * save_person() (one transaction, RLS applies).
 */
export async function savePerson(input: unknown): Promise<SavePersonResult> {
  const supabase = await signedInClient("/people");

  const parsed = personFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Something needs a quick look.",
      fieldErrors: personFieldErrors(parsed.error),
    };
  }
  const p = parsed.data;

  const { data, error } = await supabase.rpc("save_person", {
    p_id: p.id ?? undefined,
    p_name: p.name,
    p_relation_kind: p.relationKind,
    p_relation: p.description || undefined,
    p_color: p.color,
    p_birthday_day: p.day!,
    p_birthday_month: p.month!,
    p_birthday_year: p.year ?? undefined,
    p_little_things: p.littleThings,
    p_days: p.days.map((d) => ({
      id: d.id,
      kind: d.kind,
      title: d.title || null,
      recurring: d.recurring,
      day: d.day,
      month: d.month,
      year: d.year,
    })),
  });

  if (error || !data) {
    const info = personError(error?.message);
    if (info.kind === "signed_out") redirect("/log-in?next=%2Fpeople");
    if (info.kind === "known") {
      return {
        ok: false,
        message: info.message,
        fieldErrors: info.field ? { [info.field]: info.message } : undefined,
      };
    }
    return { ok: false, message: info.message };
  }

  return { ok: true, id: data, name: p.name };
}

/**
 * Removes a person: sets archived_at, so they disappear from every list and
 * from reminders, and Undo can bring them back. A job in M4 deletes people
 * archived for more than 30 days.
 */
/**
 * "In memory": someone who has passed. Every day of theirs then uses the
 * gentle Remembrance wording (app, emails, push). RLS: your own people only.
 */
export async function setInMemory(id: unknown, on: unknown): Promise<PersonActionResult> {
  const supabase = await signedInClient("/people");
  const parsed = idSchema.safeParse(id);
  if (!parsed.success || typeof on !== "boolean")
    return { ok: false, message: "I couldn't find them." };
  const { data, error } = await supabase
    .from("people")
    .update({ in_memory: on })
    .eq("id", parsed.data)
    .is("archived_at", null)
    .select("id");
  if (error) return { ok: false, message: "That didn't save. Please try again." };
  if (!data?.length) return { ok: false, message: "I couldn't find them." };
  return { ok: true };
}

export async function removePerson(id: unknown): Promise<PersonActionResult> {
  return setArchived(id, true);
}

/** Undo for removePerson. */
export async function restorePerson(id: unknown): Promise<PersonActionResult> {
  return setArchived(id, false);
}

async function setArchived(id: unknown, archived: boolean): Promise<PersonActionResult> {
  const supabase = await signedInClient("/people");
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "I couldn't find them." };

  // RLS: only your own people can be changed. Filtering on the current state
  // makes a double click a no-op instead of moving the date.
  const query = supabase
    .from("people")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", parsed.data);
  const { data, error } = await (
    archived ? query.is("archived_at", null) : query.not("archived_at", "is", null)
  ).select("id");

  if (error) return { ok: false, message: "Something went wrong on our side. Please try again." };
  if (!data?.length) return { ok: false, message: "I couldn't find them." };
  return { ok: true };
}
