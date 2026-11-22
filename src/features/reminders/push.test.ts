import { describe, expect, it } from "vitest";

import type { DueReminder, ReminderDay } from "./due";
import { isPushEndpoint, pushPayload, pushTitle, pushUrl } from "./push";

const day = (extra: Partial<ReminderDay> = {}): ReminderDay => ({
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
  littleThing: "black coffee",
  archived: false,
  wishlistFriendId: null,
  ...extra,
});
const reminder = (offset: number, extra: Partial<ReminderDay> = {}): DueReminder => ({
  key: `o1|${offset}|2026-11-13`,
  offset,
  occursOn: { year: 2026, month: 11, day: 13 },
  day: day(extra),
});

describe("push wording", () => {
  it("birthdays: never the age (lock screens), the countdown and the day", () => {
    expect(pushTitle(reminder(7))).toBe("Khalid's birthday is in 7 days 🎂");
    expect(pushTitle(reminder(1))).toBe("Khalid's birthday is tomorrow 🎂");
    expect(pushTitle(reminder(0))).toBe("It's Khalid's birthday today 🎂");
    expect(pushTitle(reminder(7))).not.toMatch(/turns|30/);
  });

  it("other days use their title", () => {
    expect(pushTitle(reminder(3, { kind: "work_milestone", title: "New job" }))).toBe(
      "Khalid · New job is in 3 days 💼",
    );
    expect(pushTitle(reminder(3, { kind: "anniversary" }))).toBe(
      "Khalid's anniversary is in 3 days 💍",
    );
  });

  it("Remembrance is gentle and opens the person, never a wishlist", () => {
    const quiet = reminder(3, {
      kind: "remembrance",
      personName: "Grandma",
      wishlistFriendId: "f1",
    });
    expect(pushTitle(quiet)).toBe("Grandma's day of remembrance is in 3 days 🕊️");
    expect(pushUrl(quiet)).toBe("/people?person=p1");
    expect(
      pushTitle(
        reminder(0, { kind: "remembrance", personName: "Sara", title: "In memory of Dad" }),
      ),
    ).toBe("Today: Sara · In memory of Dad 🕊️");
  });

  it("opens the friend's wishlist when connected with free wishes, else the person", () => {
    expect(pushUrl(reminder(7, { wishlistFriendId: "f1" }))).toBe(
      "/wishlists?tab=friends&friend=f1",
    );
    expect(pushUrl(reminder(7))).toBe("/people?person=p1");
  });

  it("one payload per person: short, no little things, wishes or reservations", () => {
    const one = pushPayload([reminder(7, { wishlistFriendId: "f1" })], "batch-1");
    expect(one).toEqual({
      title: "Khalid's birthday is in 7 days 🎂",
      body: "Friday 13 November",
      url: "/wishlists?tab=friends&friend=f1",
      tag: "batch-1",
    });
    expect(JSON.stringify(one)).not.toMatch(/coffee|reserv|taken|wish(?!lists)/i);

    const many = pushPayload(
      [reminder(1), reminder(7, { personName: "Sara" }), reminder(7, { personName: "Omar" })],
      "batch-2",
    );
    expect(many).toEqual({
      title: "Coming up: Khalid, Sara and 1 more",
      body: "3 days to keep in mind",
      url: "/home",
      tag: "batch-2",
    });
  });
});

describe("push endpoints", () => {
  it("only known push services (the server POSTs there)", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/abc:123",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QGx0abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isPushEndpoint(ok), ok).toBe(true);
    }
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com.evil.example/x",
      "https://evil.example/fcm.googleapis.com/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost:54321/functions/v1/x",
      "https://fcm.googleapis.com/",
      "javascript:alert(1)",
      42,
    ]) {
      expect(isPushEndpoint(bad), String(bad)).toBe(false);
    }
  });
});
