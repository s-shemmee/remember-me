"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { notificationsInboxEnabled } from "@/lib/flags";
import { todayIn } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { type InboxItem, inboxItem, type InboxRow, whenLabel } from "./text";

/**
 * The notification inbox (behind NOTIFICATIONS_INBOX_ENABLED). Rows are made
 * only on the server (database triggers); here we read your own (my_inbox():
 * RLS and names) and mark them read. Never anything about reservations.
 */

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/log-in");
  return { supabase, userId: userId as string };
}

export type InboxView = { items: (InboxItem & { when: string })[]; unread: number };

/** Your last 30 days, newest first. Null when the inbox is off. */
export async function loadInbox(): Promise<InboxView | null> {
  const { supabase, userId } = await signedIn();
  if (!notificationsInboxEnabled()) return null;
  const [{ data: rows, error }, { data: profile }] = await Promise.all([
    supabase.rpc("my_inbox", { p_limit: 50 }),
    supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
  ]);
  if (error) return { items: [], unread: 0 };
  const zone = profile?.timezone ?? undefined;
  const today = todayIn(zone);
  const items = ((rows ?? []) as InboxRow[])
    .map((r) => inboxItem(r, today))
    .filter((i): i is InboxItem => i !== null)
    .map((i) => ({ ...i, when: whenLabel(i.at, today, zone) }));
  return { items, unread: items.filter((i) => !i.read).length };
}

const markSchema = z.object({ ids: z.array(z.uuid()).max(100).nullable() });

/** Mark some (or, with null, all) of your notifications read. */
export async function markInboxRead(input: unknown): Promise<{ ok: boolean }> {
  const { supabase, userId } = await signedIn();
  if (!notificationsInboxEnabled()) return { ok: false };
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (parsed.data.ids) query = query.in("id", parsed.data.ids);
  const { error } = await query;
  return { ok: !error };
}

/** Settings → Notifications: "Wishlist updates from my people" (on by default). */
export async function setWishlistUpdates(on: unknown): Promise<{ ok: boolean }> {
  const { supabase, userId } = await signedIn();
  if (typeof on !== "boolean") return { ok: false };
  const values = { inbox_wishlist_updates: on, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("reminder_settings")
    .update(values)
    .eq("profile_id", userId)
    .select("profile_id");
  if (error) return { ok: false };
  if (!data?.length) {
    const { error: insertError } = await supabase.from("reminder_settings").insert(values);
    if (insertError) return { ok: false };
  }
  return { ok: true };
}
