import { describe, expect, it } from "vitest";

import { FAKE_UNSUBSCRIBE_SECRET } from "@/test/fake-values";

import type { ReminderDay, ReminderUser } from "./due";
import { type OutgoingEmail, type ReminderStore, runReminders, type SendResult } from "./run";
import {
  looksLikeUnsubscribeToken,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./unsubscribe-token";

const SECRET = FAKE_UNSUBSCRIBE_SECRET;
const USER_ID = "16fd2706-8baf-433b-82eb-8c7fada847da";

describe("unsubscribe tokens", () => {
  it("round-trips, and refuses anything changed", async () => {
    const token = await signUnsubscribeToken(USER_ID, SECRET);
    expect(looksLikeUnsubscribeToken(token)).toBe(true);
    expect(await verifyUnsubscribeToken(token, SECRET)).toBe(USER_ID);
    expect(await verifyUnsubscribeToken(token, `${SECRET}x`)).toBeNull();
    const other = "26fd2706-8baf-433b-82eb-8c7fada847da";
    expect(await verifyUnsubscribeToken(`${other}.${token.split(".")[1]}`, SECRET)).toBeNull();
    expect(await verifyUnsubscribeToken(`${token}x`, SECRET)).toBeNull();
    expect(await verifyUnsubscribeToken(`${token}.x`, SECRET)).toBeNull();
    expect(await verifyUnsubscribeToken("nonsense", SECRET)).toBeNull();
    expect(looksLikeUnsubscribeToken("javascript:alert(1)")).toBe(false);
  });

  it("needs a real secret", async () => {
    await expect(signUnsubscribeToken(USER_ID, "short")).rejects.toThrow(/32 characters/);
  });
});

// An in-memory notification_log with the same rules as the database.
type Row = {
  key: string;
  profileId: string;
  batchId: string;
  status: "claimed" | "sent" | "failed";
  claimedAt: number;
  attempts: number;
};

function fakeStore(clock: { now: number }, users: ReminderUser[], days: ReminderDay[]) {
  const rows: Row[] = [];
  const store: ReminderStore = {
    async loadCandidates() {
      const logged = new Map<string, Set<string>>();
      for (const r of rows) {
        if (!logged.has(r.profileId)) logged.set(r.profileId, new Set());
        logged.get(r.profileId)!.add(r.key);
      }
      return {
        users: users.filter((u) => u.emailOn),
        days: new Map(users.map((u) => [u.profileId, days])),
        logged,
      };
    },
    async claim(profileId, batchId, keys) {
      const claimed: string[] = [];
      for (const key of keys) {
        if (rows.some((r) => r.profileId === profileId && r.key === key)) continue; // on conflict do nothing
        rows.push({
          key,
          profileId,
          batchId,
          status: "claimed",
          claimedAt: clock.now,
          attempts: 1,
        });
        claimed.push(key);
      }
      return claimed;
    },
    async reclaimStuck() {
      const stuck = rows.filter(
        (r) => r.status === "claimed" && clock.now - r.claimedAt > 10 * 60_000,
      );
      const byBatch = new Map<string, { batchId: string; profileId: string; keys: string[] }>();
      for (const r of stuck) {
        if (r.attempts >= 5) {
          r.status = "failed";
          continue;
        }
        r.claimedAt = clock.now;
        r.attempts += 1;
        const b = byBatch.get(r.batchId) ?? {
          batchId: r.batchId,
          profileId: r.profileId,
          keys: [],
        };
        b.keys.push(r.key);
        byBatch.set(r.batchId, b);
      }
      return [...byBatch.values()];
    },
    async markSent(batchId) {
      for (const r of rows) if (r.batchId === batchId) r.status = "sent";
    },
    async release(batchId) {
      for (let i = rows.length - 1; i >= 0; i--)
        if (rows[i]!.batchId === batchId) rows.splice(i, 1);
    },
  };
  return { store, rows };
}

/** Like Resend: an idempotency key it has accepted is never delivered twice. */
function fakeResend() {
  const delivered: OutgoingEmail[] = [];
  const seen = new Set<string>();
  let mode: "ok" | "fail" | "crash-after-accept" = "ok";
  const send = async (email: OutgoingEmail): Promise<SendResult> => {
    if (mode === "fail") return { ok: false, error: "503" };
    if (seen.has(email.idempotencyKey)) return { ok: false, alreadySent: true, error: "409" };
    seen.add(email.idempotencyKey);
    delivered.push(email);
    if (mode === "crash-after-accept") throw new Error("function crashed before marking sent");
    return { ok: true, id: `re_${delivered.length}` };
  };
  return {
    send,
    delivered,
    setMode: (m: typeof mode) => (mode = m),
    calls: () => delivered.length,
  };
}

const user: ReminderUser = {
  profileId: "u1",
  email: "maya@example.com",
  firstName: "Maya",
  timezone: "Europe/London",
  offsets: [7, 1, 0],
  sendTime: "09:00",
  emailOn: true,
};
const khalid: ReminderDay = {
  occasionId: "o1",
  personId: "p1",
  personName: "Khalid",
  personColor: "butter",
  kind: "birthday",
  title: null,
  day: 13,
  month: 11,
  year: 1996,
  recurring: true,
  littleThing: null,
  archived: false,
  wishlistFriendId: null,
};

function setup(users = [user], days = [khalid]) {
  const clock = { now: Date.parse("2026-11-06T09:30:00Z") };
  const { store, rows } = fakeStore(clock, users, days);
  const resend = fakeResend();
  let n = 0;
  const run = () =>
    runReminders({
      now: new Date(clock.now),
      store,
      send: resend.send,
      render: async ({ reminders }) => ({
        subject: reminders.map((r) => r.key).join(","),
        html: "<p>hi</p>",
        text: "hi",
      }),
      headersFor: async () => ({ "List-Unsubscribe": "<https://x/unsubscribe?token=t>" }),
      newId: () => `batch-${++n}`,
    });
  return { clock, rows, resend, run };
}

describe("a reminder run", () => {
  it("claims, sends once with the batch id as idempotency key, and marks it sent", async () => {
    const { rows, resend, run } = setup();
    expect(await run()).toEqual({ sent: 1, retried: 0, failed: 0, released: 0 });
    expect(resend.delivered).toHaveLength(1);
    expect(resend.delivered[0]).toMatchObject({
      to: "maya@example.com",
      subject: "o1|7|2026-11-13",
      idempotencyKey: "batch-1",
      headers: { "List-Unsubscribe": "<https://x/unsubscribe?token=t>" },
    });
    expect(rows).toMatchObject([{ key: "o1|7|2026-11-13", status: "sent", batchId: "batch-1" }]);
    // The next run, or a retry of this one, sends nothing new.
    expect(await run()).toEqual({ sent: 0, retried: 0, failed: 0, released: 0 });
    expect(resend.delivered).toHaveLength(1);
  });

  it("a failed send stays claimed and is retried after 10 minutes with the same key", async () => {
    const { clock, rows, resend, run } = setup();
    resend.setMode("fail");
    expect(await run()).toMatchObject({ failed: 1 });
    expect(rows[0]).toMatchObject({ status: "claimed", batchId: "batch-1" });
    resend.setMode("ok");
    clock.now += 5 * 60_000; // too soon: not stuck yet, and not due again (it's logged)
    expect(await run()).toEqual({ sent: 0, retried: 0, failed: 0, released: 0 });
    clock.now += 6 * 60_000;
    expect(await run()).toEqual({ sent: 0, retried: 1, failed: 0, released: 0 });
    expect(resend.delivered.map((e) => e.idempotencyKey)).toEqual(["batch-1"]);
    expect(rows[0]!.status).toBe("sent");
  });

  it("a crash after the provider accepted it: retried with the same key, delivered once", async () => {
    const { clock, rows, resend, run } = setup();
    resend.setMode("crash-after-accept");
    await expect(run()).rejects.toThrow(/crashed/);
    expect(rows[0]!.status).toBe("claimed"); // never marked sent
    resend.setMode("ok");
    clock.now += 11 * 60_000;
    expect(await run()).toEqual({ sent: 0, retried: 1, failed: 0, released: 0 });
    expect(resend.calls()).toBe(1); // Resend saw the key: no second delivery
    expect(rows[0]!.status).toBe("sent");
  });

  it("a crash between claiming and sending loses nothing", async () => {
    const { clock, rows, resend, run } = setup();
    // As if the function died right after the claim insert.
    rows.push({
      key: "o1|7|2026-11-13",
      profileId: "u1",
      batchId: "batch-0",
      status: "claimed",
      claimedAt: clock.now,
      attempts: 1,
    });
    expect(await run()).toEqual({ sent: 0, retried: 0, failed: 0, released: 0 });
    clock.now += 11 * 60_000;
    expect(await run()).toEqual({ sent: 0, retried: 1, failed: 0, released: 0 });
    expect(resend.delivered.map((e) => [e.idempotencyKey, e.subject])).toEqual([
      ["batch-0", "o1|7|2026-11-13"],
    ]);
  });

  it("gives up after 5 attempts (marked failed)", async () => {
    const { clock, rows, resend, run } = setup();
    resend.setMode("fail");
    await run();
    for (let i = 0; i < 6; i++) {
      clock.now += 11 * 60_000;
      await run();
    }
    expect(rows[0]!.status).toBe("failed");
    expect(rows[0]!.attempts).toBe(5);
  });

  it("a stuck batch for someone who turned email off is dropped, not sent", async () => {
    const { clock, rows, resend, run } = setup();
    resend.setMode("fail");
    await run();
    user.emailOn = false;
    try {
      clock.now += 11 * 60_000;
      expect(await run()).toEqual({ sent: 0, retried: 0, failed: 0, released: 1 });
      expect(rows).toHaveLength(0);
    } finally {
      user.emailOn = true;
    }
  });

  it("two overlapping runs: only one sends", async () => {
    const { resend, run } = setup();
    const [a, b] = await Promise.all([run(), run()]);
    expect(a.sent + b.sent).toBe(1);
    expect(resend.delivered).toHaveLength(1);
  });
});
