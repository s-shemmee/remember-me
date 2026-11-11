"use server";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { reminderSettingsSchema, testEmailMessage } from "./schema";

export type SettingsResult = { ok: true } | { ok: false; message: string };
export type TestEmailResult = { ok: boolean; message: string };

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/log-in?next=%2Fsettings");
  return { supabase, userId };
}

/** Saves the reminder chips and the email switch (RLS: your own row). */
export async function saveReminderSettings(input: unknown): Promise<SettingsResult> {
  const { supabase, userId } = await signedIn();
  const parsed = reminderSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That didn't save. Please try again." };
  const values = {
    offsets_days: parsed.data.offsets,
    email: parsed.data.email,
    updated_at: new Date().toISOString(),
  };
  // The row is made at onboarding. `profile_id` isn't writable by users (it
  // defaults to auth.uid()), so update it, and only insert if it's missing.
  const { data, error } = await supabase
    .from("reminder_settings")
    .update(values)
    .eq("profile_id", userId)
    .select("profile_id");
  if (error) return { ok: false, message: "That didn't save. Please try again." };
  if (!data?.length) {
    const { error: insertError } = await supabase.from("reminder_settings").insert(values);
    if (insertError) return { ok: false, message: "That didn't save. Please try again." };
  }
  return { ok: true };
}

/**
 * "Send me a test email": the send-test-email Edge Function, called with the
 * user's own session (it sends only to their confirmed address, 3 an hour).
 * The Resend key never touches the Next app.
 */
export async function sendTestEmail(): Promise<TestEmailResult> {
  const { supabase } = await signedIn();
  const { data, error } = await supabase.functions.invoke<{ ok: true; to: string }>(
    "send-test-email",
    { method: "POST", body: {} },
  );
  if (!error && data?.ok) return { ok: true, message: testEmailMessage({ ok: true, to: data.to }) };
  let code = "failed";
  if (error instanceof FunctionsHttpError) {
    const body = (await error.context.json().catch(() => ({}))) as { error?: string };
    code = body.error ?? code;
  }
  return { ok: false, message: testEmailMessage({ ok: false, code }) };
}
