import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  formatFullDate,
  fromIsoDate,
  hourIn,
  toIsoDate,
  weekdayIndex,
} from "@/lib/dates";

import {
  type DaySource,
  greeting,
  monthEvents,
  monthGrid,
  moreThisMonth,
  nextUp,
  nextUpLine,
  noorNudge,
  remindersLine,
  upcoming,
  weekSummary,
} from "./days";

const today = { year: 2026, month: 11, day: 4 }; // a Wednesday, as in the screens

const src = (over: Partial<DaySource> = {}): DaySource => ({
  id: "o1",
  personId: "p1",
  name: "Khalid",
  isYou: false,
  kind: "birthday",
  title: null,
  day: 6,
  month: 11,
  year: 1996,
  recurring: true,
  color: "butter",
  littleThings: [],
  ...over,
});

const you = src({
  id: "you",
  personId: null,
  name: "Maya",
  isYou: true,
  day: 22,
  year: null,
  color: "rose",
});
const khalid = src({ littleThings: ["black coffee", "sci-fi"] });
const moms = src({
  id: "o2",
  personId: "p2",
  name: "Mom & Dad",
  kind: "anniversary",
  day: 16,
  year: 1994,
  color: "sky",
});
const yasmine = src({
  id: "o3",
  personId: "p3",
  name: "Yasmine",
  kind: "graduation",
  recurring: false,
  day: 24,
  year: 2026,
  color: "mint",
});
const omar = src({
  id: "o4",
  personId: "p4",
  name: "Omar",
  day: 2,
  month: 12,
  year: null,
  color: "peach",
});
const sara = src({
  id: "o5",
  personId: "p5",
  name: "Sara",
  day: 3,
  month: 3,
  year: null,
  color: "lilac",
});
const all = [sara, omar, yasmine, moms, khalid, you];

describe("dates additions", () => {
  it("reads the hour in the user's timezone", () => {
    const t = new Date("2026-11-04T23:30:00Z");
    expect(hourIn("Asia/Tokyo", t)).toBe(8);
    expect(hourIn("America/New_York", t)).toBe(18);
    expect(hourIn("UTC", t)).toBe(23);
    expect(hourIn("Mars/Olympus", t)).toBe(hourIn("Africa/Casablanca", t));
  });

  it("adds days and months across years", () => {
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(addDays({ year: 2028, month: 3, day: 1 }, -1)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    });
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("starts weeks on Monday, formats and parses dates", () => {
    expect(weekdayIndex(today)).toBe(2);
    expect(formatFullDate(today)).toBe("Wednesday 4 November");
    expect(toIsoDate({ year: 2026, month: 3, day: 7 })).toBe("2026-03-07");
    expect(fromIsoDate("2026-11-06")).toEqual({ year: 2026, month: 11, day: 6 });
    expect(fromIsoDate("2026-02-30")).toBeNull();
    expect(fromIsoDate("nope")).toBeNull();
  });
});

describe("upcoming", () => {
  it("lists days soonest first, with titles, details and countdowns", () => {
    const list = upcoming(all, today);
    expect(list.map((e) => `${e.title} | ${e.detail ?? "-"} | ${e.when}`)).toEqual([
      "Khalid's birthday | Turns 30 | in 2 days",
      "Mom & Dad's anniversary | 32 years | in 12 days",
      "Your day | - | in 18 days",
      "Yasmine's graduation | - | in 20 days",
      "Omar's birthday | - | in 28 days",
      "Sara's birthday | - | in 4 months",
    ]);
    expect(list[0]).toMatchObject({
      emoji: "🎂",
      short: "Khalid",
      date: "Fri, 6 November",
      shortDate: "Fri, 6 Nov",
    });
    expect(list[2]).toMatchObject({ emoji: "✨", short: "You" });
  });

  it("keeps only the next N days when asked", () => {
    expect(upcoming(all, today, 30).map((e) => e.short)).toEqual([
      "Khalid",
      "Mom & Dad",
      "You",
      "Yasmine",
      "Omar",
    ]);
    expect(upcoming(all, today, 3).map((e) => e.short)).toEqual(["Khalid"]);
  });

  it("a graduation with a year happens once; other days repeat", () => {
    const later = { year: 2026, month: 12, day: 1 };
    expect(upcoming([yasmine], later)).toEqual([]);
    expect(
      upcoming([src({ kind: "graduation", year: 2027, day: 24, recurring: false })], today)[0]!.on,
    ).toEqual({
      year: 2027,
      month: 11,
      day: 24,
    });
    expect(upcoming([src({ kind: "graduation", year: null })], later)[0]!.on.year).toBe(2027);
    expect(upcoming([moms], later)[0]!.on).toEqual({ year: 2027, month: 11, day: 16 });
  });

  it("puts 29 February on the 28th in non-leap years", () => {
    const leap = src({ day: 29, month: 2, year: 2004 });
    expect(upcoming([leap], today)[0]).toMatchObject({
      on: { year: 2027, month: 2, day: 28 },
      detail: "Turns 23",
    });
    expect(upcoming([leap], { year: 2027, month: 3, day: 1 })[0]!.on).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    });
  });
});

describe("month", () => {
  it("builds Monday-first weeks with padding", () => {
    const nov = monthGrid(2026, 11); // 1 November 2026 is a Sunday
    expect(nov).toHaveLength(6);
    expect(nov[0]!.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(nov[0]![6]).toEqual({ year: 2026, month: 11, day: 1 });
    expect(nov[5]![0]).toEqual({ year: 2026, month: 11, day: 30 });
    expect(nov[5]!.slice(1).every((c) => c === null)).toBe(true);
    expect(monthGrid(2027, 2)).toHaveLength(4); // February 2027 starts on a Monday: 4 full weeks
  });

  it("puts each day on its date, one-off graduations only in their year", () => {
    const nov = monthEvents(all, 2026, 11, today);
    expect([...nov.keys()].sort((a, b) => a - b)).toEqual([6, 16, 22, 24]);
    expect(monthEvents([yasmine], 2027, 11, today).size).toBe(0);
    expect(monthEvents([src({ day: 29, month: 2 })], 2027, 2, today).get(28)?.[0]?.short).toBe(
      "Khalid",
    );
  });

  it("counts the days still to come this month, today and your day included", () => {
    expect(moreThisMonth(all, today)).toBe(4);
    expect(moreThisMonth([...all, src({ id: "x", day: 4 }), src({ id: "y", day: 1 })], today)).toBe(
      5,
    );
    expect(moreThisMonth([sara], today)).toBe(0);
  });
});

describe("Home copy", () => {
  it.each([
    [4, "Good evening", "🌙"],
    [5, "Good morning", "☀️"],
    [11, "Good morning", "☀️"],
    [12, "Good afternoon", "🌤️"],
    [17, "Good afternoon", "🌤️"],
    [18, "Good evening", "🌙"],
    [23, "Good evening", "🌙"],
  ])("at %i:00 it's %s %s", (hour, text, emoji) => expect(greeting(hour)).toEqual({ text, emoji }));

  describe("Noor's nudge", () => {
    const nudge = (sources: DaySource[], hasPeople = true) =>
      noorNudge(upcoming(sources, today), hasPeople, "Maya");

    it("says 'turns N' only when the birth year is known, with a little thing and no pronoun", () => {
      expect(nudge([khalid])).toEqual({
        text: "Khalid turns 30 in 2 days 🎂 Little thing: black coffee",
        personId: "p1",
        name: "Khalid",
        isYou: false,
        kind: "birthday",
        // Without the little thing: Home adds a wish to reserve instead.
        base: "Khalid turns 30 in 2 days 🎂",
      });
      expect(nudge([src({ year: null })]).text).toBe("It's Khalid's birthday in 2 days 🎂");
      expect(nudge([src({ year: null, day: 4 })]).text).toBe("It's Khalid's birthday today 🎂");
      expect(nudge([src({ day: 5 })]).text).toBe("Khalid turns 30 tomorrow 🎂");
    });

    it("never uses he, she, him, her, his or hers", () => {
      const lines = [
        khalid,
        moms,
        yasmine,
        omar,
        src({ kind: "other", title: "Name day" }),
        src({ kind: "anniversary", year: null }),
      ].map((s) => nudge([s]).text);
      for (const line of lines) expect(line).not.toMatch(/\b(he|she|him|her|his|hers)\b/i);
    });

    it("covers anniversaries, graduations and other days", () => {
      expect(nudge([moms]).text).toBe("Mom & Dad celebrate 32 years in 12 days 💞");
      expect(nudge([src({ kind: "anniversary", year: null })]).text).toBe(
        "Khalid's anniversary is in 2 days 💞",
      );
      expect(nudge([yasmine]).text).toBe("Yasmine's graduation is in 20 days 🎓");
      expect(nudge([src({ kind: "other", title: "Name day" })]).text).toBe(
        "Khalid · Name day is in 2 days ✨",
      );
    });

    it("talks about your day, a quiet month, or no people yet", () => {
      expect(nudge([you, omar])).toMatchObject({
        text: "Your day is in 18 days ✨ You deserve a lovely one.",
        isYou: true,
      });
      expect(nudge([src({ ...you, day: 4 })]).text).toBe(
        "Happy birthday, Maya 🎂 Today is all about you.",
      );
      expect(nudge([sara]).text).toBe("Nothing in the next 30 days. A calm stretch ☁️");
      expect(nudge([you], false).text).toMatch(/^Add the first person you'd hate to forget/);
    });
  });

  it("writes the Next up line with 'turns N' only when the year is known", () => {
    const [k] = upcoming([khalid], today);
    expect(nextUpLine(k!)).toBe("turns 30 in 2 days");
    expect(nextUpLine(upcoming([omar], today)[0]!)).toBe("birthday in 28 days");
    expect(nextUpLine(upcoming([moms], today)[0]!)).toBe("anniversary in 12 days");
  });

  it("sums up the week ahead", () => {
    expect(weekSummary(upcoming(all, today))).toBe("one birthday this week");
    expect(weekSummary(upcoming([khalid, src({ id: "z", name: "Sam", day: 8 })], today))).toBe(
      "2 birthdays this week",
    );
    expect(weekSummary(upcoming([khalid, src({ ...moms, day: 7 })], today))).toBe(
      "2 days to remember this week",
    );
    expect(weekSummary(upcoming([sara, src({ ...you, day: 5 })], today))).toBe(
      "a quiet week ahead",
    );
  });

  it("lists your reminder days", () => {
    expect(remindersLine([0, 7, 1])).toBe("Noor reminds you 7 days, 1 day and the morning of.");
    expect(remindersLine([14])).toBe("Noor reminds you 2 weeks.");
  });
});

describe("occasion types on Home and Calendar", () => {
  const grandma = src({
    id: "r1",
    personId: "g",
    name: "Grandma",
    kind: "remembrance",
    day: 7,
    year: 2019,
    littleThings: ["roses"],
  });
  const sara = src({
    id: "r2",
    personId: "s",
    name: "Sara",
    kind: "remembrance",
    title: "In memory of Dad",
    day: 7,
  });
  const newJob = src({
    id: "w1",
    name: "Khalid",
    kind: "work_milestone",
    title: "New job",
    day: 20,
    year: 2026,
    recurring: false,
  });
  const workAnniv = src({
    id: "w2",
    name: "Khalid",
    kind: "work_milestone",
    title: "Work anniversary",
    day: 21,
    year: 2019,
  });
  const nudge = (sources: DaySource[]) => noorNudge(upcoming(sources, today), true, "Maya").text;

  it("Remembrance, no title: gentle, no little thing", () => {
    expect(nudge([grandma])).toBe("Grandma's day of remembrance is in 3 days 🕊️");
    expect(nudge([src({ ...grandma, day: 4 })])).toBe("Grandma's day of remembrance is today 🕊️");
  });

  it("Remembrance with a title: 'In 3 days: Sara · In memory of Dad'", () => {
    expect(nudge([sara])).toBe("In 3 days: Sara · In memory of Dad 🕊️ A kind word can mean a lot.");
    expect(nudge([src({ ...sara, day: 5 })])).toBe(
      "Tomorrow: Sara · In memory of Dad 🕊️ A kind word can mean a lot.",
    );
    expect(nudge([src({ ...sara, day: 4 })])).toBe(
      "Today: Sara · In memory of Dad 🕊️ A kind word can mean a lot.",
    );
  });

  it("Remembrance never celebrates: no 🎂, 🎉, confetti, 'celebrate', 'turns' or years", () => {
    const events = upcoming([grandma, sara], today);
    for (const e of events) {
      expect(e.gentle).toBe(true);
      expect(e.detail).toBeNull();
      expect(e.emoji).toBe("🕊️");
    }
    for (const line of [nudge([grandma]), nudge([sara])]) {
      expect(line).not.toMatch(/🎂|🎉|🥳|🎊|celebrat|turns|years|Little thing/i);
    }
  });

  it("Remembrance doesn't count as a day to celebrate, and never takes Next up", () => {
    expect(moreThisMonth([grandma, sara, khalid], today)).toBe(1);
    const events = upcoming([grandma, khalid], today);
    expect(events[0]!.source.name).toBe("Khalid"); // 2 days vs 3
    expect(nextUp(upcoming([grandma, src({ ...khalid, day: 30 })], today))?.source.name).toBe(
      "Khalid",
    );
    expect(nextUp(upcoming([grandma], today))).toBeNull();
  });

  it("other types use their title, or the type name, with their emoji", () => {
    expect(upcoming([newJob], today)[0]).toMatchObject({
      title: "Khalid · New job",
      emoji: "💼",
      detail: null,
    });
    expect(upcoming([workAnniv], today)[0]).toMatchObject({
      title: "Khalid · Work anniversary",
      detail: "7 years",
    });
    expect(upcoming([src({ kind: "anniversary", year: null })], today)[0]!.title).toBe(
      "Khalid's anniversary",
    );
    expect(nudge([newJob])).toBe("Khalid · New job is in 16 days 💼");
    expect(nudge([src({ kind: "anniversary", title: "Wedding", year: null })])).toBe(
      "Khalid · Wedding is in 2 days 💞",
    );
    expect(nextUpLine(upcoming([newJob], today)[0]!)).toBe("new job in 16 days");
  });

  it("a day set to once happens only in its year; yearly days every year", () => {
    expect(monthEvents([newJob], 2026, 11, today).get(20)?.[0]?.title).toBe("Khalid · New job");
    expect(monthEvents([newJob], 2027, 11, today).size).toBe(0);
    expect(monthEvents([workAnniv], 2030, 11, today).get(21)?.[0]?.detail).toBe("11 years");
    expect(upcoming([newJob], { year: 2026, month: 11, day: 21 })).toEqual([]);
  });
});
