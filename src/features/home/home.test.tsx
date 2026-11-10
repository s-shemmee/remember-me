import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { type DaySource, upcoming } from "../days/days";
import { ComingUp } from "./coming-up";
import { MiniMonth } from "./mini-month";

const today = { year: 2026, month: 11, day: 4 };
const src = (over: Partial<DaySource>): DaySource => ({
  id: "o1",
  personId: "p1",
  name: "Khalid",
  isYou: false,
  kind: "birthday",
  title: null,
  day: 6,
  month: 11,
  year: 1996,
  color: "butter",
  littleThings: [],
  ...over,
});
const people = [
  src({}),
  src({
    id: "o2",
    personId: "p2",
    name: "Mom & Dad",
    kind: "anniversary",
    day: 16,
    year: 1994,
    color: "sky",
  }),
  src({
    id: "o3",
    personId: "p3",
    name: "Yasmine",
    kind: "graduation",
    day: 24,
    year: 2026,
    color: "mint",
  }),
  src({ id: "o4", personId: "p4", name: "Omar", day: 2, month: 12, year: null, color: "peach" }),
];
const you = src({
  id: "you",
  personId: null,
  name: "Maya",
  isYou: true,
  day: 22,
  year: null,
  color: "rose",
});

describe("Coming up", () => {
  it("lists people's next days with filters", async () => {
    render(<ComingUp events={upcoming(people, today)} />);
    const rows = () => screen.getAllByRole("link").map((a) => a.textContent);
    expect(rows()).toEqual([
      "KHKhalidBirthday, turns 30 · Fri, 6 Novin 2 days",
      "MDMom & DadAnniversary, 32 years · Mon, 16 Novin 12 days",
      "YAYasmineGraduation · Tue, 24 Novin 20 days",
      "OMOmarBirthday · Wed, 2 Decin 28 days",
    ]);
    expect(screen.getByRole("link", { name: /^Khalid/ })).toHaveAttribute(
      "href",
      "/people?person=p1",
    );
    expect(screen.getByText("in 2 days")).toHaveClass("bg-butter", "text-butter-ink");

    await userEvent.click(screen.getByRole("button", { name: "Anniversaries" }));
    expect(screen.getByRole("button", { name: "Anniversaries" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(rows()).toEqual(["MDMom & DadAnniversary, 32 years · Mon, 16 Novin 12 days"]);
    await userEvent.click(screen.getByRole("button", { name: "Birthdays" }));
    expect(rows().map((r) => r!.split("Birthday")[0])).toEqual(["KHKhalid", "OMOmar"]);
  });

  it("says when a filter has nothing", async () => {
    render(<ComingUp events={upcoming([people[0]!], today)} />);
    await userEvent.click(screen.getByRole("button", { name: "Anniversaries" }));
    expect(screen.getByText("No anniversaries coming up.")).toBeInTheDocument();
  });

  it("shows 8 and links to Calendar for the rest", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      src({ id: `x${i}`, personId: `p${i}`, name: `P${i}`, day: 5 + i }),
    );
    render(<ComingUp events={upcoming(many, today)} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByRole("link", { name: "See all in Calendar" })).toHaveAttribute(
      "href",
      "/calendar",
    );
  });
});

describe("Mini month", () => {
  it("is a table of this month with today circled and each day described", () => {
    render(<MiniMonth sources={[...people, you]} today={today} yourColor="rose" />);
    const table = screen.getByRole("table", { name: "November 2026" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.getAttribute("abbr")),
    ).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
    const todayCell = within(table).getByText("4").closest("[aria-current]");
    expect(todayCell).toHaveAttribute("aria-current", "date");
    expect(todayCell).toHaveClass("bg-accent");
    expect(within(table).getByText(": Khalid's birthday")).toBeInTheDocument();
    expect(within(table).getByText(": Your day")).toBeInTheDocument();
    expect(screen.getByText("your day")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open calendar" })).toHaveAttribute(
      "href",
      "/calendar",
    );
  });
});
