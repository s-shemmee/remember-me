import { describe, expect, it } from "vitest";

import { FAKE_UNSUBSCRIBE_SECRET } from "@/test/fake-values";

import type { Channel, ReminderDay, ReminderUser } from "./due";
import {
  loggedKey,
  type OutgoingEmail,
  type PushDeliver,
  type ReminderStore,
  runReminders,
  type SendResult,
  type StuckBatch,
} from "./run";
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
  channel: Channel;
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
        const k = loggedKey(r.channel, r.profileId);
        if (!logged.has(k)) logged.set(k, new Set());
        logged.get(k)!.add(r.key);
      }
      return {
        users: users.filter((u) => u.emailOn || u.pushOn),
        days: new Map(users.map((u) => [u.profileId, days])),
        logged,
      };
    },
    async claim(profileId, batchId, keys, channel) {
      const claimed: string[] = [];
      for (const key of keys) {
        // on conflict (profile, occasion, offset, occurrence, channel) do nothing
        if (rows.some((r) => r.profileId === profileId && r.key === key && r.channel === channel))
          continue;
        rows.push({
          key,
          channel,
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
      const byBatch = new Map<string, StuckBatch>();
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
          channel: r.channel,
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
  pushOn: false,
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

/** A push sender with devices: "ok", "fail" (5xx) or "gone" (every device 404/410). */
function fakePush() {
  const sent: { batchId: string; keys: string[] }[] = [];
  let mode: "ok" | "fail" | "gone" = "ok";
  const deliver: PushDeliver = async (_user, reminders, batchId) => {
    if (mode === "fail") return { ok: false, error: "push 503" };
    if (mode === "gone") return { ok: false, nothingToSend: true, error: "all devices gone" };
    sent.push({ batchId, keys: reminders.map((r) => r.key) });
    return { ok: true, id: null };
  };
  return { deliver, sent, setMode: (m: typeof mode) => (mode = m) };
}

function setup(users = [user], days = [khalid], push?: PushDeliver) {
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
      push,
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
      channel: "email",
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

  describe("with push", () => {
    const both = { ...user, pushOn: true };

    it("email and push are each sent exactly once, with their own claims", async () => {
      const push = fakePush();
      const { rows, resend, run } = setup([both], [khalid], push.deliver);
      expect(await run()).toEqual({ sent: 2, retried: 0, failed: 0, released: 0 });
      expect(resend.delivered).toHaveLength(1);
      expect(push.sent).toEqual([{ batchId: "batch-2", keys: ["o1|7|2026-11-13"] }]);
      expect(rows.map((r) => `${r.channel} ${r.status}`).sort()).toEqual([
        "email sent",
        "push sent",
      ]);
      expect(await run()).toEqual({ sent: 0, retried: 0, failed: 0, released: 0 });
      expect(push.sent).toHaveLength(1);
    });

    it("push only, when email is off", async () => {
      const push = fakePush();
      const { resend, run } = setup([{ ...both, emailOn: false }], [khalid], push.deliver);
      expect(await run()).toMatchObject({ sent: 1 });
      expect(resend.delivered).toHaveLength(0);
      expect(push.sent).toHaveLength(1);
    });

    it("a failed push doesn't hold up the email, and is retried with the same tag", async () => {
      const push = fakePush();
      const { clock, rows, resend, run } = setup([both], [khalid], push.deliver);
      push.setMode("fail");
      expect(await run()).toEqual({ sent: 1, retried: 0, failed: 1, released: 0 });
      expect(resend.delivered).toHaveLength(1);
      expect(rows.find((r) => r.channel === "push")!.status).toBe("claimed");
      push.setMode("ok");
      clock.now += 11 * 60_000;
      expect(await run()).toEqual({ sent: 0, retried: 1, failed: 0, released: 0 });
      expect(push.sent).toEqual([{ batchId: "batch-2", keys: ["o1|7|2026-11-13"] }]);
      expect(resend.delivered).toHaveLength(1);
    });

    it("every device gone: the push claim is dropped, the email still goes", async () => {
      const push = fakePush();
      push.setMode("gone");
      const { rows, resend, run } = setup([both], [khalid], push.deliver);
      expect(await run()).toEqual({ sent: 1, retried: 0, failed: 0, released: 1 });
      expect(resend.delivered).toHaveLength(1);
      expect(rows.map((r) => r.channel)).toEqual(["email"]);
    });

    it("no push sender configured: push is skipped", async () => {
      const { rows, run } = setup([both]);
      expect(await run()).toMatchObject({ sent: 1 });
      expect(rows.map((r) => r.channel)).toEqual(["email"]);
    });
  });
});

describe("your own day", () => {
  const me: ReminderUser = { ...user, ownDay: { day: 13, month: 11 } };

  it("comes in its own email, a week before and on the morning itself, once each", async () => {
    const { clock, resend, run } = setup([me]);
    expect(await run()).toMatchObject({ sent: 2, failed: 0 });
    // Never mixed in with your people's days.
    expect(resend.delivered.map((e) => e.subject)).toEqual(["o1|7|2026-11-13", "you|7|2026-11-13"]);
    expect(await run()).toMatchObject({ sent: 0 });

    clock.now = Date.parse("2026-11-13T09:30:00Z");
    await run();
    expect(resend.delivered.map((e) => e.subject).slice(2)).toEqual([
      "o1|0|2026-11-13",
      "you|0|2026-11-13",
    ]);
    expect(await run()).toMatchObject({ sent: 0 });
  });

  it("is off by default: nothing about your day without the switch", async () => {
    const { resend, run } = setup([user]);
    await run();
    expect(resend.delivered.map((e) => e.subject)).toEqual(["o1|7|2026-11-13"]);
  });

  it("a stuck own-day email is retried with the same key", async () => {
    const { clock, resend, run } = setup([me], []);
    resend.setMode("fail");
    expect(await run()).toMatchObject({ failed: 1 });
    resend.setMode("ok");
    clock.now += 11 * 60_000;
    expect(await run()).toMatchObject({ retried: 1 });
    expect(resend.delivered).toMatchObject([
      { subject: "you|7|2026-11-13", idempotencyKey: "batch-1" },
    ]);
  });
});
