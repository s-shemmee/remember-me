/**
 * The database side of the reminder job (service role), and the per-user
 * email headers. The logic itself is src/features/reminders/run.ts.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { ReminderDay, ReminderUser } from "../../../src/features/reminders/due.ts";
import type { Candidates, ReminderStore, StuckBatch } from "../../../src/features/reminders/run.ts";
import { signUnsubscribeToken } from "../../../src/features/reminders/unsubscribe-token.ts";

import { appUrl, functionsUrl, secretKey, SUPABASE_URL, unsubscribeSecret } from "./env.ts";

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
      const [rows, keys] = await Promise.all([
        db.rpc("reminder_candidates"),
        db.rpc("reminder_log_keys"),
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
            emailOn: true,
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
        });
      }
      const logged = new Map<string, Set<string>>();
      for (const k of must<{ profile_id: string; key: string }[]>(keys, "reminder_log_keys") ??
        []) {
        if (!logged.has(k.profile_id)) logged.set(k.profile_id, new Set());
        logged.get(k.profile_id)!.add(k.key);
      }
      return { users: [...users.values()], days, logged };
    },
    async claim(profileId, batchId, keys) {
      const res = await db.rpc("claim_reminders", {
        p_profile_id: profileId,
        p_batch_id: batchId,
        p_keys: keys,
      });
      return (must<string[]>(res, "claim_reminders") ?? []).map(String);
    },
    async reclaimStuck(): Promise<StuckBatch[]> {
      const res = await db.rpc("reclaim_stuck_reminders");
      return (
        must<{ batch_id: string; profile_id: string; keys: string[] }[]>(
          res,
          "reclaim_stuck_reminders",
        ) ?? []
      ).map((b) => ({ batchId: b.batch_id, profileId: b.profile_id, keys: b.keys }));
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
