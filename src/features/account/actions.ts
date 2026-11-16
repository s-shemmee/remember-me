"use server";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import {
  deleteAccountSchema,
  emailChangeSchema,
  passwordChangeSchema,
  REAUTH_MESSAGE,
} from "@/features/profile/schema";
import { siteOrigin } from "@/lib/site-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { reauthenticate } from "./reauth";

export type AccountResult =
  | { ok: true; message: string }
  | { ok: false; message: string; field?: "email" | "password" | "current" | "next" };

const OOPS = "Something went wrong on our side. Please try again.";
const WRONG_PASSWORD = "That password isn't right.";

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/log-in?next=%2Fsettings");
  return supabase;
}

/**
 * Change email: re-authenticate (password, or a recent sign-in for Google
 * accounts), then Supabase emails both addresses; nothing changes until the
 * new one is confirmed (/auth/confirm, type email_change).
 */
export async function changeEmail(input: unknown): Promise<AccountResult> {
  const supabase = await signedIn();
  const parsed = emailChangeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That doesn't look like an email address.", field: "email" };
  }
  const auth = await reauthenticate(supabase, parsed.data.password);
  if (auth.result === "wrong-password")
    return { ok: false, message: WRONG_PASSWORD, field: "password" };
  if (auth.result === "sign-in-again") return { ok: false, message: REAUTH_MESSAGE };
  if (auth.email?.toLowerCase() === parsed.data.email.toLowerCase()) {
    return { ok: false, message: "That's already your email.", field: "email" };
  }
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  );
  if (error) {
    return error.code === "email_exists"
      ? { ok: false, message: "That email is already used by another account.", field: "email" }
      : { ok: false, message: OOPS };
  }
  return {
    ok: true,
    message: `Almost there. Check ${parsed.data.email} (and your current inbox) to confirm the change.`,
  };
}

/** Change password: the current password first, then the new one (8+). */
export async function changePassword(input: unknown): Promise<AccountResult> {
  const supabase = await signedIn();
  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] === "current" ? "current" : "next";
    return { ok: false, message: parsed.error.issues[0]?.message ?? OOPS, field };
  }
  const auth = await reauthenticate(supabase, parsed.data.current);
  if (auth.mode !== "password") return { ok: false, message: "This account signs in with Google." };
  if (auth.result !== "ok") return { ok: false, message: WRONG_PASSWORD, field: "current" };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
  if (error) {
    return error.code === "same_password"
      ? { ok: false, message: "That's your current password. Pick a new one.", field: "next" }
      : { ok: false, message: OOPS };
  }
  return { ok: true, message: "Password changed ✓" };
}

/**
 * Log out of all devices: every session ends, and every device's push
 * subscription goes too (those devices aren't signed in any more).
 */
export async function logOutEverywhere(): Promise<void> {
  const supabase = await signedIn();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (userId) {
    await supabase.from("push_subscriptions").delete().eq("profile_id", userId);
    await supabase.from("reminder_settings").update({ push: false }).eq("profile_id", userId);
  }
  await supabase.auth.signOut({ scope: "global" });
  redirect("/log-in");
}

/**
 * Delete my account: the delete-account Edge Function does it with the
 * secret key, for the signed-in user only, after checking the typed email
 * and re-authenticating again itself. Then this browser is signed out.
 */
export async function deleteAccount(input: unknown): Promise<AccountResult> {
  const supabase = await signedIn();
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Type your email to confirm.", field: "email" };
  const { error } = await supabase.functions.invoke("delete-account", {
    method: "POST",
    body: parsed.data,
  });
  if (error) {
    let code = "failed";
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => ({}))) as { error?: string };
      code = body.error ?? code;
    }
    switch (code) {
      case "email_mismatch":
        return { ok: false, message: "That's not the email on this account.", field: "email" };
      case "wrong_password":
        return { ok: false, message: WRONG_PASSWORD, field: "password" };
      case "sign_in_again":
        return { ok: false, message: REAUTH_MESSAGE };
      default:
        return { ok: false, message: OOPS };
    }
  }
  // The user no longer exists: clear this browser's session cookies.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  redirect("/log-in?deleted=1");
}
