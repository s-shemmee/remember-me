import { describe, expect, it } from "vitest";

import { minutesIn } from "@/lib/dates";

import {
  dueReminders,
  occursOn,
  reminderKey,
  type ReminderDay,
  type ReminderUser,
  sendMinutes,
} from "./due";

const user = (extra: Partial<ReminderUser> = {}): ReminderUser => ({
  profileId: "u1",
  email: "maya@example.com",
  firstName: "Maya",
  timezone: "Europe/London",
  offsets: [14, 7, 3, 1, 0],
  sendTime: "09:00:00",
  emailOn: true,
  ...extra,
});
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
const due = (
  now: string,
  u: Partial<ReminderUser> = {},
  days: ReminderDay[] = [day()],
  sent: string[] = [],
) => dueReminders({ now: new Date(now), user: user(u), days, sent: new Set(sent) });
const keys = (...args: Parameters<typeof due>) => due(...args).map((r) => r.key);

describe("send time: 9:00 on the user's own wall clock", () => {
  it("is due from 9:00 local, not a minute before", () => {
    // London is on GMT in November: 9:00 local = 09:00Z. 13 Nov − 7 = 6 Nov.
    expect(keys("2026-11-06T08:59:00Z")).toEqual([]);
    expect(keys("2026-11-06T09:00:00Z")).toEqual(["o1|7|2026-11-13"]);
  });

  it("a late run still sends the same local day, but not the next one", () => {
    expect(keys("2026-11-06T23:50:00Z")).toEqual(["o1|7|2026-11-13"]);
    // 7 Nov: the 7-day reminder has passed (6 days is not an offset).
    expect(keys("2026-11-07T10:00:00Z")).toEqual([]);
  });

  it("reads 'HH:MM' and 'HH:MM:SS', and falls back to 9:00", () => {
    expect(sendMinutes("09:00")).toBe(540);
    expect(sendMinutes("09:00:00")).toBe(540);
    expect(sendMinutes("18:30")).toBe(1110);
    expect(sendMinutes("nonsense")).toBe(540);
    expect(sendMinutes(null)).toBe(540);
  });

  it("works either side of midnight UTC (UTC+14 and UTC−11)", () => {
    // Kiritimati: 19:00Z on 5 Nov is already 9:00 on 6 Nov.
    expect(keys("2026-11-05T19:00:00Z", { timezone: "Pacific/Kiritimati" })).toEqual([
      "o1|7|2026-11-13",
    ]);
    expect(keys("2026-11-05T18:59:00Z", { timezone: "Pacific/Kiritimati" })).toEqual([]);
    // Pago Pago: 9:00 on 6 Nov is 20:00Z the same day.
    expect(keys("2026-11-06T20:00:00Z", { timezone: "Pacific/Pago_Pago" })).toEqual([
      "o1|7|2026-11-13",
    ]);
    expect(keys("2026-11-06T19:59:00Z", { timezone: "Pacific/Pago_Pago" })).toEqual([]);
  });

  it("an unknown timezone falls back to Casablanca", () => {
    const bad = due("2026-11-06T23:00:00Z", { timezone: "Mars/Olympus" });
    expect(bad.map((r) => r.key)).toEqual(["o1|7|2026-11-13"]);
  });
});

describe("daylight saving", () => {
  const onDay = (d: number, m: number) => [day({ day: d, month: m, year: null })];

  it("London, clocks forward on 29 March 2026: 9:00 is 08:00Z that day, 09:00Z the day before", () => {
    expect(keys("2026-03-28T08:59:00Z", {}, onDay(28, 3))).toEqual([]);
    expect(keys("2026-03-28T09:00:00Z", {}, onDay(28, 3))).toEqual(["o1|0|2026-03-28"]);
    expect(keys("2026-03-29T07:59:00Z", {}, onDay(29, 3))).toEqual([]);
    expect(keys("2026-03-29T08:00:00Z", {}, onDay(29, 3))).toEqual(["o1|0|2026-03-29"]);
  });

  it("New York, forward on 8 March and back on 1 November", () => {
    const ny = { timezone: "America/New_York" };
    expect(keys("2026-03-07T13:59:00Z", ny, onDay(7, 3))).toEqual([]);
    expect(keys("2026-03-07T14:00:00Z", ny, onDay(7, 3))).toEqual(["o1|0|2026-03-07"]);
    expect(keys("2026-03-08T12:59:00Z", ny, onDay(8, 3))).toEqual([]);
    expect(keys("2026-03-08T13:00:00Z", ny, onDay(8, 3))).toEqual(["o1|0|2026-03-08"]);
    expect(keys("2026-11-01T13:59:00Z", ny, onDay(1, 11))).toEqual([]);
    expect(keys("2026-11-01T14:00:00Z", ny, onDay(1, 11))).toEqual(["o1|0|2026-11-01"]);
  });

  it("Casablanca, which moves to GMT for Ramadan: GMT+1 in early February, GMT in March", () => {
    const casa = { timezone: "Africa/Casablanca" };
    expect(minutesIn("Africa/Casablanca", new Date("2026-02-10T08:00:00Z"))).toBe(540);
    expect(keys("2026-02-10T07:59:00Z", casa, onDay(10, 2))).toEqual([]);
    expect(keys("2026-02-10T08:00:00Z", casa, onDay(10, 2))).toEqual(["o1|0|2026-02-10"]);
    expect(keys("2026-03-01T08:59:00Z", casa, onDay(1, 3))).toEqual([]);
    expect(keys("2026-03-01T09:00:00Z", casa, onDay(1, 3))).toEqual(["o1|0|2026-03-01"]);
  });
});

describe("offsets", () => {
  it.each([
    [14, "2026-10-30"],
    [7, "2026-11-06"],
    [3, "2026-11-10"],
    [1, "2026-11-12"],
    [0, "2026-11-13"],
  ])("%i days before is sent on %s", (offset, on) => {
    expect(keys(`${on}T10:00:00Z`)).toEqual([`o1|${offset}|2026-11-13`]);
  });

  it("only the offsets the user picked", () => {
    expect(keys("2026-11-10T10:00:00Z", { offsets: [7, 1, 0] })).toEqual([]);
    expect(keys("2026-11-12T10:00:00Z", { offsets: [7, 1, 0] })).toEqual(["o1|1|2026-11-13"]);
    // Unknown offsets are ignored.
    expect(keys("2026-11-11T10:00:00Z", { offsets: [2] })).toEqual([]);
  });

  it("nothing at all with email off or no offsets", () => {
    expect(keys("2026-11-06T10:00:00Z", { emailOn: false })).toEqual([]);
    expect(keys("2026-11-06T10:00:00Z", { offsets: [] })).toEqual([]);
  });

  it("several days at once, soonest first", () => {
    const days = [
      day({ occasionId: "a", personName: "Sara", day: 20, month: 11 }),
      day({ occasionId: "b", personName: "Omar", day: 7, month: 11 }),
    ];
    expect(keys("2026-11-06T10:00:00Z", {}, days)).toEqual(["b|1|2026-11-07", "a|14|2026-11-20"]);
  });
});

describe("dates", () => {
  const feb29 = (extra: Partial<ReminderDay> = {}) =>
    day({ day: 29, month: 2, year: 2000, ...extra });

  it("29 February falls on 28 February in other years", () => {
    expect(keys("2027-02-27T10:00:00Z", {}, [feb29()])).toEqual(["o1|1|2027-02-28"]);
    expect(keys("2027-02-28T10:00:00Z", {}, [feb29()])).toEqual(["o1|0|2027-02-28"]);
    // Leap year: the real 29th, and nothing on the 28th itself.
    expect(keys("2028-02-28T10:00:00Z", {}, [feb29()])).toEqual(["o1|1|2028-02-29"]);
    expect(keys("2028-02-29T10:00:00Z", {}, [feb29()])).toEqual(["o1|0|2028-02-29"]);
  });

  it("yearly days repeat, across New Year too", () => {
    const jan3 = [day({ day: 3, month: 1 })];
    expect(keys("2026-12-27T10:00:00Z", {}, jan3)).toEqual(["o1|7|2027-01-03"]);
    expect(keys("2031-12-27T10:00:00Z", {}, jan3)).toEqual(["o1|7|2032-01-03"]);
  });

  it("a day that happens once: only in its year, never after", () => {
    const grad = [day({ kind: "graduation", day: 1, month: 12, year: 2026, recurring: false })];
    expect(keys("2026-11-17T10:00:00Z", {}, grad)).toEqual(["o1|14|2026-12-01"]);
    expect(keys("2027-11-17T10:00:00Z", {}, grad)).toEqual([]);
    expect(keys("2026-12-02T10:00:00Z", {}, grad)).toEqual([]);
    // Once without a year can't happen: never sent.
    expect(
      occursOn(
        { day: 1, month: 12, year: null, recurring: false },
        { year: 2026, month: 12, day: 1 },
      ),
    ).toBe(false);
  });
});

describe("skips", () => {
  it("archived people", () => {
    expect(keys("2026-11-06T10:00:00Z", {}, [day({ archived: true })])).toEqual([]);
  });

  it("anything already in notification_log, whatever its status", () => {
    expect(keys("2026-11-06T10:00:00Z", {}, [day()], ["o1|7|2026-11-13"])).toEqual([]);
    // A different year's key doesn't count.
    expect(keys("2026-11-06T10:00:00Z", {}, [day()], ["o1|7|2025-11-13"])).toEqual([
      "o1|7|2026-11-13",
    ]);
  });

  it("builds the log key from occasion, offset and occurrence date (with its year)", () => {
    expect(reminderKey("o1", 7, { year: 2026, month: 11, day: 13 })).toBe("o1|7|2026-11-13");
    expect(reminderKey("o1", 0, "2027-02-28")).toBe("o1|0|2027-02-28");
  });
});
