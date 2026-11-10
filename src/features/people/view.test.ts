import { describe, expect, it } from "vitest";

import { dayView, filterPeople, type PersonRow, peopleView, personView } from "./view";

const today = { year: 2026, month: 11, day: 4 };

const row = (over: Partial<PersonRow> = {}): PersonRow => ({
  id: "p1",
  name: "Khalid",
  relation: null,
  relation_kind: "Best friend",
  color: "butter",
  group: "friends",
  little_things: ["black coffee"],
  occasions: [
    { id: "o1", kind: "birthday", title: null, day: 6, month: 11, year: 1996, recurring: true },
  ],
  ...over,
});

describe("dayView", () => {
  it("writes a birthday with the age they turn, as in the screens", () => {
    expect(
      dayView(
        { id: "o", kind: "birthday", title: null, day: 6, month: 11, year: 1996, recurring: true },
        today,
      ),
    ).toMatchObject({
      emoji: "🎂",
      label: "Birthday",
      title: "Birthday, turns 30",
      date: "Fri, 6 November",
      when: "in 2 days",
      daysUntil: 2,
    });
  });

  it("counts anniversary years; without a year it's just the kind", () => {
    expect(
      dayView(
        {
          id: "o",
          kind: "anniversary",
          title: null,
          day: 16,
          month: 11,
          year: 1994,
          recurring: true,
        },
        today,
      ).title,
    ).toBe("Anniversary, 32 years");
    expect(
      dayView(
        {
          id: "o",
          kind: "anniversary",
          title: null,
          day: 16,
          month: 11,
          year: 2025,
          recurring: true,
        },
        today,
      ).title,
    ).toBe("Anniversary, 1 year");
    expect(
      dayView(
        { id: "o", kind: "birthday", title: null, day: 6, month: 11, year: null, recurring: true },
        today,
      ).title,
    ).toBe("Birthday");
  });

  it("uses the title for 'something else' and never counts a graduation", () => {
    const other = dayView(
      {
        id: "o",
        kind: "other",
        title: " Name day ",
        day: 3,
        month: 5,
        year: 2000,
        recurring: true,
      },
      today,
    );
    expect(other).toMatchObject({ label: "Name day", title: "Name day", emoji: "✨" });
    expect(
      dayView(
        {
          id: "o",
          kind: "graduation",
          title: null,
          day: 24,
          month: 11,
          year: 2027,
          recurring: false,
        },
        today,
      ),
    ).toMatchObject({ title: "Graduation", when: "in 13 months" }); // once, in 2027
    expect(
      dayView(
        {
          id: "o",
          kind: "graduation",
          title: null,
          day: 24,
          month: 6,
          year: 2025,
          recurring: false,
        },
        today,
      ),
    ).toMatchObject({ when: "passed", date: "Tue, 24 June 2025" });
    expect(
      dayView(
        {
          id: "o",
          kind: "graduation",
          title: null,
          day: 24,
          month: 11,
          year: null,
          recurring: true,
        },
        today,
      ),
    ).toMatchObject({ when: "in 20 days" });
  });

  it("is 'today' on the day, and a 29 February birthday falls on the 28th", () => {
    expect(
      dayView(
        { id: "o", kind: "birthday", title: null, day: 4, month: 11, year: null, recurring: true },
        today,
      ).when,
    ).toBe("today");
    expect(
      dayView(
        { id: "o", kind: "birthday", title: null, day: 29, month: 2, year: 2004, recurring: true },
        today,
      ),
    ).toMatchObject({ date: "Sun, 28 February", title: "Birthday, turns 23" });
  });
});

describe("personView", () => {
  it("shows the description when set, otherwise the chip", () => {
    expect(personView(row({ relation: "Brother from uni" }), today).relationLabel).toBe(
      "Brother from uni",
    );
    expect(personView(row(), today).relationLabel).toBe("Best friend");
  });

  it("sorts days soonest first and fills the edit form", () => {
    const p = personView(
      row({
        occasions: [
          { id: "b", kind: "birthday", title: null, day: 9, month: 1, year: 1965, recurring: true },
          {
            id: "a",
            kind: "anniversary",
            title: null,
            day: 16,
            month: 11,
            year: 1993,
            recurring: true,
          },
        ],
      }),
      today,
    );
    expect(p.days.map((d) => d.id)).toEqual(["a", "b"]);
    expect(p.next?.label).toBe("Anniversary");
    expect(p.form).toMatchObject({
      id: "p1",
      relationKind: "Best friend",
      description: "",
      color: "butter",
      day: 9,
      month: 1,
      year: 1965,
      days: [
        {
          id: "a",
          kind: "anniversary",
          title: "",
          day: 16,
          month: 11,
          year: 1993,
          recurring: true,
        },
      ],
    });
  });

  it("falls back safely on unknown values from the database", () => {
    const p = personView(row({ relation_kind: null, color: "black" }), today);
    expect(p.form.relationKind).toBe("Friend");
    expect(p.color).toBe("lilac");
  });
});

describe("peopleView and filterPeople", () => {
  const people = peopleView(
    [
      row({
        id: "far",
        name: "Sara",
        group: "friends",
        occasions: [
          { id: "1", kind: "birthday", title: null, day: 3, month: 3, year: null, recurring: true },
        ],
      }),
      row({
        id: "soon",
        name: "Omar",
        group: "work",
        occasions: [
          {
            id: "2",
            kind: "birthday",
            title: null,
            day: 5,
            month: 11,
            year: null,
            recurring: true,
          },
        ],
      }),
      row({
        id: "mom",
        name: "Mom & Dad",
        group: "family",
        occasions: [
          {
            id: "3",
            kind: "birthday",
            title: null,
            day: 20,
            month: 11,
            year: null,
            recurring: true,
          },
        ],
      }),
    ],
    today,
  );

  it("puts the soonest day first", () => {
    expect(people.map((p) => p.id)).toEqual(["soon", "mom", "far"]);
  });

  it("filters by group and searches names, ignoring case", () => {
    expect(filterPeople(people, "family", "").map((p) => p.name)).toEqual(["Mom & Dad"]);
    expect(filterPeople(people, "all", "  sA ").map((p) => p.name)).toEqual(["Sara"]);
    expect(filterPeople(people, "work", "sara")).toEqual([]);
  });
});
