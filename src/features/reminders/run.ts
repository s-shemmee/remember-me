/**
 * One run of the reminder job (every 15 minutes), with its I/O passed in so
 * it can be tested: the Edge Function gives it the database (`store`), the
 * mailer (Resend, or Mailpit locally) and the push sender.
 *
 * Two channels, email and push, each with its own claims in
 * notification_log: each is sent exactly once, and one failing never holds
 * up the other. Web push has no idempotency key; a retried push batch
 * reuses its tag (the batch id), so the device replaces the notification
 * instead of showing it twice.
 *
 * Never twice, never lost:
 * 1. Stuck batches first: rows still `claimed` after 10 minutes (a crash
 *    between claiming and sending) are re-claimed and sent again with the
 *    SAME idempotency key (the batch id), so Resend sends at most once.
 * 2. Then what's newly due: rows are claimed (`insert … on conflict do
 *    nothing`) before sending; only what this run actually claimed is sent.
 * 3. Sent → `sent`. A failed send stays `claimed` and is retried (same key)
 *    once it's 10 minutes old; after 5 attempts it's marked `failed`.
 */
import {
  type Channel,
  dueOwnDay,
  dueReminders,
  type DueReminder,
  OWN_DAY_ID,
  ownDayReminderDay,
  type ReminderDay,
  reminderKey,
  type ReminderUser,
} from "./due.ts";
import { fromIsoDate } from "../../lib/dates.ts";
import type { RenderedEmail } from "./email.tsx";

export type Candidates = {
  users: ReminderUser[];
  days: Map<string, ReminderDay[]>;
  /**
   * Keys already in notification_log (claimed, sent or failed), per
   * `loggedKey(channel, profileId)`.
   */
  logged: Map<string, Set<string>>;
};

export const loggedKey = (channel: Channel, profileId: string) => `${channel}:${profileId}`;

export type StuckBatch = { batchId: string; profileId: string; channel: Channel; keys: string[] };

export type ReminderStore = {
  loadCandidates(): Promise<Candidates>;
  /** Inserts claims; returns the keys this call actually claimed. */
  claim(profileId: string, batchId: string, keys: string[], channel: Channel): Promise<string[]>;
  /** Claims older than 10 minutes, re-stamped so no other run takes them. */
  reclaimStuck(): Promise<StuckBatch[]>;
  markSent(batchId: string, providerId: string | null): Promise<void>;
  /** Drops a batch's claims (nothing left to send, e.g. email turned off). */
  release(batchId: string): Promise<void>;
};

export type OutgoingEmail = RenderedEmail & {
  to: string;
  headers: Record<string, string>;
  idempotencyKey: string;
  /** Where a reply goes (feedback: the person who sent it). */
  replyTo?: string;
};

export type SendResult =
  | { ok: true; id: string | null }
  /**
   * `alreadySent`: the provider already accepted this idempotency key.
   * `nothingToSend`: no device left (all gone), so the claims are dropped.
   */
  | { ok: false; alreadySent?: boolean; nothingToSend?: boolean; error: string };

export type PushDeliver = (
  user: ReminderUser,
  reminders: DueReminder[],
  batchId: string,
) => Promise<SendResult>;

export type RunDeps = {
  now: Date;
  store: ReminderStore;
  send: (email: OutgoingEmail) => Promise<SendResult>;
  render: (args: { user: ReminderUser; reminders: DueReminder[] }) => Promise<RenderedEmail>;
  /** List-Unsubscribe and friends, per user. */
  headersFor: (user: ReminderUser) => Promise<Record<string, string>>;
  /** Sends one push to all of a user's devices. Without it, push is skipped. */
  push?: PushDeliver;
  newId: () => string;
};

const CHANNELS: Channel[] = ["email", "push"];

export type RunSummary = { sent: number; retried: number; failed: number; released: number };

/** Rebuilds a stuck batch's reminders from today's data (same keys, same order). */
function remindersForKeys(keys: string[], days: ReminderDay[], user: ReminderUser): DueReminder[] {
  const byId = new Map(days.map((d) => [d.occasionId, d]));
  const own = ownDayReminderDay(user);
  if (own) byId.set(OWN_DAY_ID, own);
  const out: DueReminder[] = [];
  for (const key of keys) {
    const [occasionId, offset, iso] = key.split("|");
    const day = occasionId ? byId.get(occasionId) : undefined;
    const on = fromIsoDate(iso);
    if (!day || day.archived || !on) continue;
    out.push({
      key: reminderKey(day.occasionId, Number(offset), on),
      offset: Number(offset),
      occursOn: on,
      day,
    });
  }
  return out.sort(
    (a, b) => a.offset - b.offset || a.day.personName.localeCompare(b.day.personName),
  );
}

export async function runReminders(deps: RunDeps): Promise<RunSummary> {
  const { store } = deps;
  const summary: RunSummary = { sent: 0, retried: 0, failed: 0, released: 0 };
  const candidates = await store.loadCandidates();
  const users = new Map(candidates.users.map((u) => [u.profileId, u]));

  const viaEmail = async (user: ReminderUser, reminders: DueReminder[], batchId: string) => {
    const email = await deps.render({ user, reminders });
    return deps.send({
      ...email,
      to: user.email,
      headers: await deps.headersFor(user),
      idempotencyKey: batchId,
    });
  };

  /** true = sent, false = stays claimed (retried with the same key after 10 minutes). */
  const deliver = async (
    channel: Channel,
    user: ReminderUser,
    reminders: DueReminder[],
    batchId: string,
  ): Promise<"sent" | "failed" | "released"> => {
    const result =
      channel === "email"
        ? await viaEmail(user, reminders, batchId)
        : await deps.push!(user, reminders, batchId);
    if (result.ok || result.alreadySent) {
      await store.markSent(batchId, result.ok ? result.id : null);
      return "sent";
    }
    if (result.nothingToSend) {
      await store.release(batchId);
      return "released";
    }
    return "failed";
  };

  const channelOn = (channel: Channel, user: ReminderUser) =>
    channel === "email" ? user.emailOn : user.pushOn && Boolean(deps.push);

  // 1. Stuck batches: same batch id, same idempotency key (or push tag).
  for (const stuck of await store.reclaimStuck()) {
    const user = users.get(stuck.profileId);
    const reminders =
      user && channelOn(stuck.channel, user)
        ? remindersForKeys(stuck.keys, candidates.days.get(user.profileId) ?? [], user)
        : [];
    if (!user || !reminders.length) {
      await store.release(stuck.batchId);
      summary.released += 1;
      continue;
    }
    const outcome = await deliver(stuck.channel, user, reminders, stuck.batchId);
    if (outcome === "sent") summary.retried += 1;
    else if (outcome === "released") summary.released += 1;
    else summary.failed += 1;
  }

  // 2. Newly due, per channel: your people's days in one batch, your own
  // day in its own (its own email or notification, never mixed in).
  for (const user of candidates.users) {
    for (const channel of CHANNELS) {
      if (!channelOn(channel, user)) continue;
      const sent = candidates.logged.get(loggedKey(channel, user.profileId)) ?? new Set<string>();
      const batches = [
        dueReminders({
          now: deps.now,
          user,
          days: candidates.days.get(user.profileId) ?? [],
          sent,
          channel,
        }),
        dueOwnDay({ now: deps.now, user, sent, channel }),
      ];
      for (const due of batches) {
        if (!due.length) continue;
        const batchId = deps.newId();
        const claimed = new Set(
          await store.claim(
            user.profileId,
            batchId,
            due.map((d) => d.key),
            channel,
          ),
        );
        const mine = due.filter((d) => claimed.has(d.key));
        if (!mine.length) continue; // another run got them
        const outcome = await deliver(channel, user, mine, batchId);
        if (outcome === "sent") summary.sent += 1;
        else if (outcome === "released") summary.released += 1;
        else summary.failed += 1;
      }
    }
  }
  return summary;
}
