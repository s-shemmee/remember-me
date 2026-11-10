import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DaySource } from "../days/days";

// useSearchParams follows history.pushState / replaceState, as in Next.
vi.mock("next/navigation", async () => {
  const React = await import("react");
  const listeners = new Set<() => void>();
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History["pushState"]>) => {
      original(...args);
      listeners.forEach((l) => l());
    };
  }
  return {
    useSearchParams: () =>
      new URLSearchParams(
        React.useSyncExternalStore(
          (cb) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
          },
          () => window.location.search,
        ),
      ),
  };
});

const { CalendarScreen } = await import("./calendar-screen");

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
const sources = [
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
    id: "you",
    personId: null,
    name: "Maya",
    isYou: true,
    day: 22,
    year: null,
    color: "rose",
  }),
  src({ id: "o3", personId: "p3", name: "Omar", day: 2, month: 12, year: null, color: "peach" }),
  src({ id: "o4", personId: "p4", name: "Sara", day: 1, month: 11, year: null, color: "lilac" }),
];

const renderCalendar = () =>
  render(
    <CalendarScreen
      sources={sources}
      today={today}
      remindersLine="Noor reminds you 7 days, 1 day and the morning of."
    />,
  );
const grid = () => screen.getByRole("grid");
const cell = (name: RegExp) => within(grid()).getByRole("gridcell", { name });
const press = async (key: string) => {
  await userEvent.keyboard(`{${key}}`);
};

beforeEach(() => window.history.replaceState(null, "", "/calendar"));

describe("Calendar", () => {
  it("shows this month with name tags, today marked and selected, and today's details", () => {
    renderCalendar();
    expect(screen.getByRole("heading", { level: 2, name: "November 2026" })).toBeInTheDocument();
    expect(grid()).toHaveAccessibleName("November 2026");
    const todayCell = cell(/^Wednesday 4 November, today$/);
    expect(todayCell).toHaveAttribute("aria-current", "date");
    expect(todayCell).toHaveAttribute("aria-selected", "true");
    expect(todayCell).toHaveAttribute("tabindex", "0");
    expect(cell(/^Friday 6 November, Khalid's birthday$/)).toHaveAttribute("tabindex", "-1");
    expect(within(grid()).getByText("🎂 Khalid")).toHaveClass("bg-butter", "text-butter-ink");
    expect(
      screen.getByRole("heading", { name: "Today · Wednesday 4 November" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nothing on this day. A quiet one ☁️")).toBeInTheDocument();
  });

  it("past days get a grey number and no background, never opacity", () => {
    renderCalendar();
    const past = cell(/^Sunday 1 November, Sara's birthday$/);
    expect(past).not.toHaveClass("bg-card2");
    expect(past.className).not.toMatch(/opacity/);
    expect(within(past).getByText("1")).toHaveClass("text-sub");
    expect(cell(/^Friday 6 November/)).toHaveClass("bg-card2");
  });

  it("clicking a day selects it, shows its details and puts it in the URL", async () => {
    renderCalendar();
    await userEvent.click(cell(/^Monday 16 November/));
    expect(window.location.search).toBe("?month=2026-11&day=2026-11-16");
    const panel = screen.getByRole("region", { name: "Monday 16 November" });
    expect(within(panel).getByText("Mom & Dad's anniversary")).toBeInTheDocument();
    expect(within(panel).getByText("32 years · in 12 days")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "See Mom & Dad" })).toHaveAttribute(
      "href",
      "/people?person=p2",
    );
  });

  it("your day links to Celebrate Me", async () => {
    renderCalendar();
    await userEvent.click(cell(/^Sunday 22 November/));
    const panel = screen.getByRole("region", { name: "Sunday 22 November" });
    expect(within(panel).getByText("Your day")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Celebrate Me" })).toHaveAttribute(
      "href",
      "/celebrate",
    );
  });

  it("arrow keys, Home / End and Page Up / Down move the selection and focus", async () => {
    renderCalendar();
    cell(/^Wednesday 4 November/).focus();
    await press("ArrowRight");
    await waitFor(() => expect(cell(/^Thursday 5 November/)).toHaveFocus());
    await press("ArrowDown");
    await waitFor(() => expect(cell(/^Thursday 12 November/)).toHaveFocus());
    await press("Home");
    await waitFor(() => expect(cell(/^Monday 9 November/)).toHaveFocus());
    await press("End");
    await waitFor(() => expect(cell(/^Sunday 15 November/)).toHaveFocus());
    await press("ArrowUp");
    await waitFor(() => expect(cell(/^Sunday 8 November/)).toHaveFocus());
    expect(cell(/^Sunday 8 November/)).toHaveAttribute("aria-selected", "true");

    await press("PageDown");
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2, name: "December 2026" })).toBeInTheDocument(),
    );
    await waitFor(() => expect(cell(/^Tuesday 8 December/)).toHaveFocus());
    expect(window.location.search).toBe("?month=2026-12&day=2026-12-08");
    await press("PageUp");
    await waitFor(() => expect(cell(/^Sunday 8 November/)).toHaveFocus());
  });

  it("moving past the end of the month goes to the next month", async () => {
    window.history.replaceState(null, "", "/calendar?month=2026-11&day=2026-11-30");
    renderCalendar();
    cell(/^Monday 30 November/).focus();
    await press("ArrowRight");
    await waitFor(() => expect(cell(/^Tuesday 1 December/)).toHaveFocus());
    await press("ArrowLeft");
    await waitFor(() => expect(cell(/^Monday 30 November/)).toHaveFocus());
  });

  it("previous, next and Today change the month", async () => {
    renderCalendar();
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("heading", { level: 2, name: "December 2026" })).toBeInTheDocument();
    expect(cell(/^Wednesday 2 December, Omar's birthday$/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("heading", { level: 2, name: "October 2026" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(cell(/^Wednesday 4 November, today$/)).toHaveAttribute("aria-selected", "true");
  });

  it("lists the next 30 days, your day included, and jumps to one", async () => {
    renderCalendar();
    const next = screen.getByRole("region", { name: "Next 30 days" });
    const items = within(next)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(items).toEqual([
      "NOV6🎂 Khalid's birthdayFri, 6 November, in 2 days",
      "NOV16💍 Mom & Dad's anniversaryMon, 16 November, in 12 days",
      "NOV22✨ Your daySun, 22 November, in 18 days",
      "DEC2🎂 Omar's birthdayWed, 2 December, in 28 days",
    ]);
    await userEvent.click(within(next).getByRole("button", { name: /Omar's birthday/ }));
    expect(screen.getByRole("heading", { level: 2, name: "December 2026" })).toBeInTheDocument();
    expect(cell(/^Wednesday 2 December/)).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByText("Noor reminds you 7 days, 1 day and the morning of."),
    ).toBeInTheDocument();
  });
});
