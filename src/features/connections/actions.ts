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

/** A new invite link (7 days, once). With a person, accepting links them. */
export async function createInvite(personId?: unknown): Promise<CreateInviteResult> {
  const supabase = await signedIn();
  const person = personId == null ? null : idSchema.safeParse(personId);
  if (person && !person.success) return { ok: false, message: "I couldn't find them." };
  const { data, error } = await supabase.rpc("create_invite", {
    p_person_id: person?.data ?? undefined,
  });
  if (error || !data) {
    if (error?.message === "too_many_invites") {
      return { ok: false, message: "You have 20 open invites. Cancel one to make a new link." };
    }
    if (error?.message === "already_connected") {
      return { ok: false, message: "You're already connected." };
    }
    if (error?.message === "person_not_found")
      return { ok: false, message: "I couldn't find them." };
    return { ok: false, message: OOPS };
  }
  return { ok: true, url: `${await siteOrigin()}/invite/${data}` };
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
