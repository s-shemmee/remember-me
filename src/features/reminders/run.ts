/**
 * One run of the reminder job (every 15 minutes), with its I/O passed in so
 * it can be tested: the Edge Function gives it the database (`store`) and
 * the mailer (Resend, or Mailpit locally).
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
  dueReminders,
  type DueReminder,
  type ReminderDay,
  reminderKey,
  type ReminderUser,
} from "./due.ts";
import { fromIsoDate } from "../../lib/dates.ts";
import type { RenderedEmail } from "./email.tsx";

export type Candidates = {
  users: ReminderUser[];
  days: Map<string, ReminderDay[]>;
  /** Per user: keys already in notification_log (claimed, sent or failed). */
  logged: Map<string, Set<string>>;
};

export type StuckBatch = { batchId: string; profileId: string; keys: string[] };

export type ReminderStore = {
  loadCandidates(): Promise<Candidates>;
  /** Inserts claims; returns the keys this call actually claimed. */
  claim(profileId: string, batchId: string, keys: string[]): Promise<string[]>;
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
};

export type SendResult =
  | { ok: true; id: string | null }
  /** `alreadySent`: the provider already accepted this idempotency key. */
  | { ok: false; alreadySent?: boolean; error: string };

export type RunDeps = {
  now: Date;
  store: ReminderStore;
  send: (email: OutgoingEmail) => Promise<SendResult>;
  render: (args: { user: ReminderUser; reminders: DueReminder[] }) => Promise<RenderedEmail>;
  /** List-Unsubscribe and friends, per user. */
  headersFor: (user: ReminderUser) => Promise<Record<string, string>>;
  newId: () => string;
};

export type RunSummary = { sent: number; retried: number; failed: number; released: number };

/** Rebuilds a stuck batch's reminders from today's data (same keys, same order). */
function remindersForKeys(keys: string[], days: ReminderDay[]): DueReminder[] {
  const byId = new Map(days.map((d) => [d.occasionId, d]));
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

  const deliver = async (user: ReminderUser, reminders: DueReminder[], batchId: string) => {
    const email = await deps.render({ user, reminders });
    const result = await deps.send({
      ...email,
      to: user.email,
      headers: await deps.headersFor(user),
      idempotencyKey: batchId,
    });
    if (result.ok || result.alreadySent) {
      await store.markSent(batchId, result.ok ? result.id : null);
      return true;
    }
    return false; // stays claimed: retried with the same key after 10 minutes
  };

  // 1. Stuck batches: same batch id, same idempotency key.
  for (const stuck of await store.reclaimStuck()) {
    const user = users.get(stuck.profileId);
    const reminders = user
      ? remindersForKeys(stuck.keys, candidates.days.get(user.profileId) ?? [])
      : [];
    if (!user || !reminders.length) {
      await store.release(stuck.batchId);
      summary.released += 1;
      continue;
    }
    if (await deliver(user, reminders, stuck.batchId)) summary.retried += 1;
    else summary.failed += 1;
  }

  // 2. Newly due.
  for (const user of candidates.users) {
    const due = dueReminders({
      now: deps.now,
      user,
      days: candidates.days.get(user.profileId) ?? [],
      sent: candidates.logged.get(user.profileId) ?? new Set(),
    });
    if (!due.length) continue;
    const batchId = deps.newId();
    const claimed = new Set(
      await store.claim(
        user.profileId,
        batchId,
        due.map((d) => d.key),
      ),
    );
    const mine = due.filter((d) => claimed.has(d.key));
    if (!mine.length) continue; // another run got them
    if (await deliver(user, mine, batchId)) summary.sent += 1;
    else summary.failed += 1;
  }
  return summary;
}
