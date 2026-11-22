"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { siteOrigin } from "@/lib/site-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { INVITE_COOKIE, inviteErrorStatus, type InviteStatus, isInviteToken } from "./invite-token";

const OOPS = "Something went wrong on our side. Please try again.";
const idSchema = z.uuid();

async function signedIn(next = "/profile") {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/log-in?next=${encodeURIComponent(next)}`);
  return supabase;
}

export type CreateInviteResult = { ok: true; url: string } | { ok: false; message: string };

/** What the invite functions' errors mean, in plain words. */
function inviteError(message: string | undefined): string {
  switch (message) {
    case "too_many_invites":
      return "You have 20 open invites. Cancel one to make a new link.";
    case "too_many_invites_today":
      return "That's a lot of invites for one day. Try again tomorrow.";
    case "too_many_resets":
      return "You've reset your link a few times today. Try again tomorrow.";
    case "already_connected":
      return "You're already connected.";
    case "person_not_found":
      return "I couldn't find them.";
    default:
      return OOPS;
  }
}

const linkFor = async (token: string) => `${await siteOrigin()}/invite/${token}`;

/**
 * An invite link. For one of your people: their open invite (7 days, once;
 * accepting links them), or a new one. Without a person: your personal link.
 */
export async function createInvite(personId?: unknown): Promise<CreateInviteResult> {
  const supabase = await signedIn();
  const person = personId == null ? null : idSchema.safeParse(personId);
  if (person && !person.success) return { ok: false, message: "I couldn't find them." };
  const { data, error } = await supabase.rpc("create_invite", {
    p_person_id: person?.data ?? undefined,
  });
  if (error || !data) return { ok: false, message: inviteError(error?.message) };
  return { ok: true, url: await linkFor(data) };
}

/** "Reset link": your personal link stops working; a new one replaces it. */
export async function resetInviteLink(): Promise<CreateInviteResult> {
  const supabase = await signedIn();
  const { data, error } = await supabase.rpc("reset_invite_link");
  if (error || !data) return { ok: false, message: inviteError(error?.message) };
  return { ok: true, url: await linkFor(data) };
}

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function revokeInvite(id: unknown): Promise<ActionResult> {
  const supabase = await signedIn();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "I couldn't find that invite." };
  const { error } = await supabase.rpc("revoke_invite", { p_invite_id: parsed.data });
  return error ? { ok: false, message: "I couldn't cancel that invite." } : { ok: true };
}

export type AcceptResult =
  { ok: true } | { ok: false; status: InviteStatus | null; message: string };

/** Accepts an invite: both people become connected. Clears the invite cookie. */
export async function acceptInvite(token: unknown): Promise<AcceptResult> {
  if (!isInviteToken(token)) {
    return { ok: false, status: "not_found", message: "I can't find this invite." };
  }
  const supabase = await signedIn(`/invite/${token}`);
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  // Only if it's still there: changing cookies makes Next re-render the page,
  // which would replace the "You're connected" message.
  const jar = await cookies();
  if (jar.has(INVITE_COOKIE)) jar.delete(INVITE_COOKIE);
  if (error) {
    const status = inviteErrorStatus(error.message);
    return { ok: false, status, message: status ? "This invite can't be used." : OOPS };
  }
  return { ok: true };
}

export async function removeConnection(id: unknown): Promise<ActionResult> {
  const supabase = await signedIn();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "I couldn't find that connection." };
  const { error } = await supabase.rpc("remove_connection", { p_connection_id: parsed.data });
  return error ? { ok: false, message: "I couldn't remove that connection." } : { ok: true };
}

const linkSchema = z.object({
  profileId: z.uuid(),
  /** The person to link, or null to unlink whoever is linked now. */
  personId: z.uuid().nullable(),
  currentPersonId: z.uuid().nullable(),
});

/** "This is Khalid": links one of your people to a connection (or unlinks). */
export async function linkConnection(input: unknown): Promise<ActionResult> {
  const supabase = await signedIn();
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That didn't work. Please try again." };
  const { profileId, personId, currentPersonId } = parsed.data;
  const { error } = personId
    ? await supabase.rpc("link_person", { p_person_id: personId, p_profile_id: profileId })
    : currentPersonId
      ? await supabase.rpc("unlink_person", { p_person_id: currentPersonId })
      : { error: null };
  return error ? { ok: false, message: "That didn't work. Please try again." } : { ok: true };
}

// Linking your people to accounts (no duplicates) ---------------------------------------------

export type DayMonthValue = { day: number; month: number };

export type LinkAccountResult =
  | {
      ok: true;
      /** The duplicate merged into this person, if there was one. */
      merged: string | null;
      /** Their profile's birthday when it differs from yours (asked, never changed silently). */
      theirBirthday: DayMonthValue | null;
    }
  | { ok: false; message: string };

const linkAccountSchema = z.object({ personId: z.uuid(), profileId: z.uuid() });

/** Their shared birthday (null when they don't share it), from my_friends(). */
async function sharedBirthday(
  supabase: Awaited<ReturnType<typeof signedIn>>,
  profileId: string,
): Promise<DayMonthValue | null> {
  const { data } = await supabase.rpc("my_friends");
  const f = (data ?? []).find((x) => x.profile_id === profileId);
  return f?.birthday_day && f.birthday_month
    ? { day: f.birthday_day, month: f.birthday_month }
    : null;
}

/**
 * "Link to account" / "Link" in the prompt: links one of your people to a
 * connection. Another of your people already linked to them is merged into
 * this one (your fields win) and removed. Says when their birthday differs.
 */
export async function linkPersonToAccount(input: unknown): Promise<LinkAccountResult> {
  const supabase = await signedIn("/people");
  const parsed = linkAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That didn't work. Please try again." };
  const { personId, profileId } = parsed.data;
  const { data: merged, error } = await supabase.rpc("link_person_to_account", {
    p_person_id: personId,
    p_profile_id: profileId,
  });
  if (error) {
    return {
      ok: false,
      message:
        error.message === "not_connected"
          ? "You're not connected with them any more."
          : "That didn't work. Please try again.",
    };
  }
  const [theirs, { data: mine }] = await Promise.all([
    sharedBirthday(supabase, profileId),
    supabase
      .from("occasions")
      .select("day, month")
      .eq("person_id", personId)
      .eq("kind", "birthday")
      .maybeSingle(),
  ]);
  const differs = theirs && mine && (theirs.day !== mine.day || theirs.month !== mine.month);
  return { ok: true, merged: merged ?? null, theirBirthday: differs ? theirs : null };
}

const addFromSchema = z.object({
  profileId: z.uuid(),
  day: z.number().int().min(1).max(31).nullable(),
  month: z.number().int().min(1).max(12).nullable(),
});

/** "No, add as new": a new person for someone who joined, linked to them. */
export async function addPersonFromConnection(
  input: unknown,
): Promise<{ ok: true; personId: string } | { ok: false; message: string }> {
  const supabase = await signedIn("/people");
  const parsed = addFromSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick their birthday first." };
  const { profileId, day, month } = parsed.data;
  const { data, error } = await supabase.rpc("add_person_from_connection", {
    p_profile_id: profileId,
    p_birthday_day: day ?? undefined,
    p_birthday_month: month ?? undefined,
  });
  if (error || !data) {
    const message =
      error?.message === "birthday_needed" || error?.message === "invalid_birthday"
        ? "Pick their birthday first."
        : error?.message === "already_linked"
          ? "They're already in your people."
          : "That didn't work. Please try again.";
    return { ok: false, message };
  }
  return { ok: true, personId: data };
}

/** Unlink: keeps your person, removes the link to their account. */
export async function unlinkPersonFromAccount(personId: unknown): Promise<ActionResult> {
  const supabase = await signedIn("/people");
  const parsed = idSchema.safeParse(personId);
  if (!parsed.success) return { ok: false, message: "I couldn't find them." };
  const { error } = await supabase.rpc("unlink_person", { p_person_id: parsed.data });
  return error ? { ok: false, message: "That didn't work. Please try again." } : { ok: true };
}

/**
 * "Use theirs": your person's birthday takes the day and month their profile
 * shares (your year stays, unless it can't hold that date).
 */
export async function applyAccountBirthday(personId: unknown): Promise<ActionResult> {
  const supabase = await signedIn("/people");
  const parsed = idSchema.safeParse(personId);
  if (!parsed.success) return { ok: false, message: "I couldn't find them." };
  const { data: person } = await supabase
    .from("people")
    .select("linked_profile_id, occasions(id, kind, year)")
    .eq("id", parsed.data)
    .maybeSingle();
  const birthday = person?.occasions.find((o) => o.kind === "birthday");
  if (!person?.linked_profile_id || !birthday)
    return { ok: false, message: "I couldn't find them." };
  const theirs = await sharedBirthday(supabase, person.linked_profile_id);
  if (!theirs) return { ok: false, message: "Their birthday isn't shared any more." };
  const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const year =
    birthday.year && theirs.day === 29 && theirs.month === 2 && !leap(birthday.year)
      ? null
      : birthday.year;
  const { error } = await supabase
    .from("occasions")
    .update({ day: theirs.day, month: theirs.month, year })
    .eq("id", birthday.id);
  return error ? { ok: false, message: "That didn't save. Please try again." } : { ok: true };
}
