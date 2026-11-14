"use server";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isPushEndpoint } from "@/features/reminders/push";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { testPushMessage } from "./messages";

export type NotificationsResult = { ok: true } | { ok: false; message: string };

const OOPS = "Something went wrong on our side. Please try again.";

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/log-in?next=%2Fsettings");
  return { supabase, userId };
}

const subscriptionSchema = z.object({
  endpoint: z.string().refine(isPushEndpoint, { error: "unknown push service" }),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{86,88}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{21,24}$/),
  }),
  label: z.string().trim().min(1).max(60),
});

/**
 * Saves this device's push subscription (only after the user tapped "Turn on
 * notifications" and the browser granted permission) and turns push on.
 */
export async function savePushSubscription(input: unknown): Promise<NotificationsResult> {
  const { supabase } = await signedIn();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "This browser's notifications aren't supported here." };
  }
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_device_label: parsed.data.label,
  });
  if (error) return { ok: false, message: OOPS };
  return { ok: true };
}

/** Removes one of your devices (RLS: your own only). No devices left: push is off. */
export async function removeDevice(id: unknown): Promise<NotificationsResult> {
  const { supabase, userId } = await signedIn();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: "I couldn't find that device." };
  const { error } = await supabase.from("push_subscriptions").delete().eq("id", parsed.data);
  if (error) return { ok: false, message: OOPS };
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true });
  if (!count) await setPush(supabase, userId, false);
  return { ok: true };
}

/** "Turn off notifications": removes every device of yours and turns push off. */
export async function turnOffPush(): Promise<NotificationsResult> {
  const { supabase, userId } = await signedIn();
  const { error } = await supabase.from("push_subscriptions").delete().eq("profile_id", userId);
  if (error) return { ok: false, message: OOPS };
  await setPush(supabase, userId, false);
  return { ok: true };
}

async function setPush(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  push: boolean,
) {
  await supabase
    .from("reminder_settings")
    .update({ push, updated_at: new Date().toISOString() })
    .eq("profile_id", userId);
}

/** "Send me a test notification": the send-test-push Edge Function, as you. */
export async function sendTestNotification(): Promise<{ ok: boolean; message: string }> {
  const { supabase } = await signedIn();
  const { data, error } = await supabase.functions.invoke<{ ok: true; sent: number }>(
    "send-test-push",
    { method: "POST", body: {} },
  );
  if (!error && data?.ok)
    return { ok: true, message: testPushMessage({ ok: true, sent: data.sent }) };
  let code = "failed";
  if (error instanceof FunctionsHttpError) {
    const body = (await error.context.json().catch(() => ({}))) as { error?: string };
    code = body.error ?? code;
  }
  return { ok: false, message: testPushMessage({ ok: false, code }) };
}
