import { describe, expect, it } from "vitest";

import {
  type DaySource,
  eventOn,
  moreThisMonth,
  nextUp,
  noorNudge,
  upcoming,
} from "@/features/days/days";
import { dayView } from "@/features/people/view";
import { reminderLine } from "@/features/reminders/copy";
import type { DueReminder, ReminderDay } from "@/features/reminders/due";
import { pushPayload, pushTitle } from "@/features/reminders/push";
import { giftsSorted } from "@/features/reservations/logic";

import { typeFor } from "./types";

const today = { year: 2026, month: 11, day: 16 };
const grandma = (extra: Partial<DaySource> = {}): DaySource => ({
  id: "o1",
  personId: "p1",
  name: "Grandma",
  isYou: false,
  kind: "birthday",
  title: null,
  day: 19,
  month: 11,
  year: 1940,
  recurring: true,
  color: "rose",
  littleThings: ["jasmine tea"],
  inMemory: true,
  ...extra,
});
const reminderDay = (extra: Partial<ReminderDay> = {}): ReminderDay => ({
  occasionId: "o1",
  personId: "p1",
  personName: "Grandma",
  personColor: "rose",
  kind: "birthday",
  title: null,
  day: 19,
  month: 11,
  year: 1940,
  recurring: true,
  littleThing: "jasmine tea",
  archived: false,
  wishlistFriendId: "f1",
  inMemory: true,
  ...extra,
});
const due = (extra: Partial<ReminderDay> = {}): DueReminder => ({
  key: "o1|3|2026-11-19",
  offset: 3,
  occursOn: { year: 2026, month: 11, day: 19 },
  day: reminderDay(extra),
});

const NEVER = /turns|🎂|🎉|celebrat|gift|wishlist|reserve|little thing|jasmine/i;

describe('"In memory": every day of theirs is gentle', () => {
  it("the type: 🕊️, gentle, no years counted, still called a birthday", () => {
    expect(typeFor("birthday", true)).toMatchObject({
      emoji: "🕊️",
      gentle: true,
      countsYears: false,
      noun: "birthday",
    });
    expect(typeFor("birthday", false).emoji).toBe("🎂");
  });

  it("in the app: no 'turns N', 🕊️, quiet, never Next up or a day to celebrate", () => {
    const e = eventOn(grandma(), { year: 2026, month: 11, day: 19 }, today);
    expect(e).toMatchObject({ emoji: "🕊️", gentle: true, detail: null });
    const events = upcoming([grandma()], today);
    expect(nextUp(events)).toBeNull();
    expect(moreThisMonth([grandma()], today)).toBe(0);
    const nudge = noorNudge(events, true, "Maya");
    expect(nudge.text).toBe("Grandma's birthday is in 3 days 🕊️");
    expect(nudge.gentle).toBe(true);
    expect(nudge.text).not.toMatch(NEVER);
  });

  it("on their People profile", () => {
    const v = dayView(
      { id: "o1", kind: "birthday", title: null, day: 19, month: 11, year: 1940, recurring: true },
      today,
      true,
    );
    expect(v).toMatchObject({ emoji: "🕊️", gentle: true, title: "Birthday" });
  });

  it("in emails: gentle line, no little thing, no wishlist", () => {
    expect(reminderLine(due())).toEqual({
      headline: "Grandma's birthday is in 3 days 🕊️",
      date: "Thursday 19 November",
      detail: "A kind word can mean a lot.",
      gentle: true,
      wishlistLabel: null,
    });
  });

  it("in push: the same gentle title, opening the person", () => {
    expect(pushTitle(due())).toBe("Grandma's birthday is in 3 days 🕊️");
    const payload = pushPayload([due()], "b1");
    expect(payload.url).toBe("/people?person=p1");
    expect(JSON.stringify(payload)).not.toMatch(NEVER);
  });

  it("left out of Gifts sorted", () => {
    expect(
      giftsSorted([
        {
          profileId: "f1",
          name: "Grandma",
          pastel: "rose",
          character: null,
          birthday: { day: 19, month: 11 },
          daysUntil: 3,
          linkedPersonId: "p1",
          inMemory: true,
          wishes: [
            {
              id: "w1",
              title: "Tea set",
              url: null,
              price: null,
              currency: "MAD",
              note: null,
              priority: "like",
              imageUrl: null,
              status: "free",
            },
          ],
        },
      ]),
    ).toEqual({ value: "All calm", line: "no wishlist birthdays in 30 days" });
  });

  it("without it, nothing changes", () => {
    expect(noorNudge(upcoming([grandma({ inMemory: false })], today), true, "C").text).toBe(
      "Grandma turns 86 in 3 days 🎂 Little thing: jasmine tea",
    );
    expect(reminderLine(due({ inMemory: false })).headline).toBe("Grandma turns 86 in 3 days 🎂");
  });
});
