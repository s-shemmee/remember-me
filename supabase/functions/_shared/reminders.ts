/**
 * The database side of the reminder job (service role), and the per-user
 * email headers. The logic itself is src/features/reminders/run.ts.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Channel, ReminderDay, ReminderUser } from "../../../src/features/reminders/due.ts";
import { pushPayload } from "../../../src/features/reminders/push.ts";
import {
  type Candidates,
  loggedKey,
  type PushDeliver,
  type ReminderStore,
  type StuckBatch,
} from "../../../src/features/reminders/run.ts";
import { signUnsubscribeToken } from "../../../src/features/reminders/unsubscribe-token.ts";

import { appUrl, functionsUrl, secretKey, SUPABASE_URL, unsubscribeSecret } from "./env.ts";
import { type Device, pushConfigured, pushToDevices } from "./push.ts";

export const adminClient = (): SupabaseClient =>
  createClient(SUPABASE_URL, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

type CandidateRow = {
  profile_id: string;
  email: string;
  first_name: string;
  timezone: string | null;
  offsets: number[];
  send_time: string;
  email_on: boolean;
  push_on: boolean;
  occasion_id: string;
  person_id: string;
  person_name: string;
  person_color: string;
  kind: string;
  title: string | null;
  day: number;
  month: number;
  year: number | null;
  recurring: boolean;
  little_thing: string | null;
  wishlist_friend_id: string | null;
  in_memory: boolean;
};

type OwnDayRow = {
  profile_id: string;
  email: string;
  first_name: string;
  timezone: string | null;
  send_time: string;
  email_on: boolean;
  push_on: boolean;
  birthday_day: number;
  birthday_month: number;
};

const must = <T>(
  result: { data: T | null; error: { message: string } | null },
  what: string,
): T => {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
};

export function reminderStore(db: SupabaseClient): ReminderStore {
  return {
    async loadCandidates(): Promise<Candidates> {
      const [rows, keys, ownDays] = await Promise.all([
        db.rpc("reminder_candidates"),
        db.rpc("reminder_log_keys"),
        db.rpc("own_day_candidates"),
      ]);
      const users = new Map<string, ReminderUser>();
      const days = new Map<string, ReminderDay[]>();
      for (const r of must<CandidateRow[]>(rows, "reminder_candidates") ?? []) {
        if (!users.has(r.profile_id)) {
          users.set(r.profile_id, {
            profileId: r.profile_id,
            email: r.email,
            firstName: r.first_name,
            timezone: r.timezone,
            offsets: r.offsets,
            sendTime: r.send_time,
            emailOn: r.email_on,
            pushOn: r.push_on && pushConfigured(),
          });
          days.set(r.profile_id, []);
        }
        days.get(r.profile_id)!.push({
          occasionId: r.occasion_id,
          personId: r.person_id,
          personName: r.person_name,
          personColor: r.person_color,
          kind: r.kind,
          title: r.title,
          day: r.day,
          month: r.month,
          year: r.year,
          recurring: r.recurring,
          littleThing: r.little_thing,
          archived: false,
          wishlistFriendId: r.wishlist_friend_id,
          inMemory: r.in_memory,
        });
      }
      // "Remind me about my own day": the same user (or a new one with no
      // people reminders), with their birthday.
      for (const r of must<OwnDayRow[]>(ownDays, "own_day_candidates") ?? []) {
        const ownDay = { day: r.birthday_day, month: r.birthday_month };
        const user = users.get(r.profile_id);
        if (user) {
          user.ownDay = ownDay;
          continue;
        }
        users.set(r.profile_id, {
          profileId: r.profile_id,
          email: r.email,
          firstName: r.first_name,
          timezone: r.timezone,
          offsets: [],
          sendTime: r.send_time,
          emailOn: r.email_on,
          pushOn: r.push_on && pushConfigured(),
          ownDay,
        });
        days.set(r.profile_id, []);
      }
      const logged = new Map<string, Set<string>>();
      for (const k of must<{ profile_id: string; channel: Channel; key: string }[]>(
        keys,
        "reminder_log_keys",
      ) ?? []) {
        const id = loggedKey(k.channel, k.profile_id);
        if (!logged.has(id)) logged.set(id, new Set());
        logged.get(id)!.add(k.key);
      }
      return { users: [...users.values()], days, logged };
    },
    async claim(profileId, batchId, keys, channel) {
      const res = await db.rpc("claim_reminders", {
        p_profile_id: profileId,
        p_batch_id: batchId,
        p_keys: keys,
        p_channel: channel,
      });
      return (must<string[]>(res, "claim_reminders") ?? []).map(String);
    },
    async reclaimStuck(): Promise<StuckBatch[]> {
      const res = await db.rpc("reclaim_stuck_reminders");
      return (
        must<{ batch_id: string; profile_id: string; channel: Channel; keys: string[] }[]>(
          res,
          "reclaim_stuck_reminders",
        ) ?? []
      ).map((b) => ({
        batchId: b.batch_id,
        profileId: b.profile_id,
        channel: b.channel,
        keys: b.keys,
      }));
    },
    async markSent(batchId, providerId) {
      must(
        await db.rpc("finish_reminders", { p_batch_id: batchId, p_provider_id: providerId }),
        "finish_reminders",
      );
    },
    async release(batchId) {
      must(await db.rpc("release_reminders", { p_batch_id: batchId }), "release_reminders");
    },
  };
}

/** Links and headers for one reader: body link to the app page, one-click POST in the header. */
export async function unsubscribeLinks(profileId: string) {
  const token = await signUnsubscribeToken(profileId, unsubscribeSecret());
  const oneClick = `${functionsUrl()}/unsubscribe?token=${encodeURIComponent(token)}`;
  return {
    links: {
      appUrl: appUrl(),
      unsubscribeUrl: `${appUrl()}/unsubscribe?token=${encodeURIComponent(token)}`,
    },
    headers: {
      "List-Unsubscribe": `<${oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/**
 * Push for the reminder run: every device of the user, loaded once per run.
 * Sent if at least one device accepted (its last_used_at is updated); devices
 * the push service reports gone (404/410) are deleted; no device left means
 * nothing to send (the claim is dropped).
 */
export async function pushDeliverer(db: SupabaseClient): Promise<PushDeliver | undefined> {
  if (!pushConfigured()) return undefined;
  const res = await db.rpc("reminder_push_devices");
  const byUser = new Map<string, Device[]>();
  for (const d of must<(Device & { profile_id: string })[]>(res, "reminder_push_devices") ?? []) {
    const list = byUser.get(d.profile_id) ?? [];
    list.push({ id: d.id, endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth });
    byUser.set(d.profile_id, list);
  }
  return async (user, reminders, batchId) => {
    const devices = byUser.get(user.profileId) ?? [];
    if (!devices.length) return { ok: false, nothingToSend: true, error: "no devices" };
    const results = await pushToDevices(devices, pushPayload(reminders, batchId));
    return settleDevices(db, results, devices.length);
  };
}

/** Updates last_used_at, deletes gone devices, and turns per-device results into one. */
export async function settleDevices(
  db: SupabaseClient,
  results: { id: string; status: "sent" | "gone" | "failed" }[],
  total: number,
) {
  const sent = results.filter((r) => r.status === "sent").map((r) => r.id);
  const gone = results.filter((r) => r.status === "gone").map((r) => r.id);
  if (sent.length) {
    await db
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .in("id", sent);
  }
  if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);
  if (sent.length) return { ok: true as const, id: null };
  if (gone.length === total) {
    return { ok: false as const, nothingToSend: true, error: "all devices gone" };
  }
  return { ok: false as const, error: "push failed" };
}
