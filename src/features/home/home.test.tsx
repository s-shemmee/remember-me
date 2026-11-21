import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { type DaySource, upcoming } from "../days/days";
import { HomePlanCard } from "../plans/components/home-plan-card";
import { PlansProvider } from "../plans/components/plan-state";
import { type PlanView, targetFor } from "../plans/steps";
import { ComingUp } from "./coming-up";
import { MiniMonth } from "./mini-month";

const planActions = vi.hoisted(() => ({
  startPlan: vi.fn(),
  tickStep: vi.fn(),
  renameStep: vi.fn(),
  removeStep: vi.fn(),
  addStep: vi.fn(),
  saveNote: vi.fn(),
}));
vi.mock("@/features/messages/actions", () => ({
  draftNoorMessages: vi.fn(),
  saveMessageInPlan: vi.fn(),
}));
vi.mock("../plans/actions", () => planActions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

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
  recurring: true,
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
    recurring: false,
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

describe("birthday plans on Home", () => {
  const khalid = upcoming([src({})], today)[0]!;
  const planFor = (done: number[]): PlanView => ({
    id: "11111111-1111-4111-8111-111111111111",
    occasionId: "o1",
    occursOn: "2026-11-06",
    note: "",
    steps: ["Gift", "Message", "Call", "Cake"].map((label, i) => ({
      id: `2222222${i}-2222-4222-8222-222222222222`,
      kind: (["gift", "message", "call", "cake"] as const)[i]!,
      label,
      position: i,
      done: done.includes(i),
      byReservation: false,
    })),
  });

  it("Coming up shows a plan's dots; a day without a plan shows none", () => {
    render(
      <PlansProvider plans={[planFor([0])]}>
        <ComingUp events={upcoming(people, today)} />
      </PlansProvider>,
    );
    expect(screen.getAllByRole("img", { name: /^Plan \d+ of \d+ done$/ })).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Plan 1 of 4 done" })).toBeInTheDocument();
  });

  it("the plan card: ticking a suggestion starts the plan, and the dots follow", async () => {
    planActions.startPlan.mockResolvedValue({ ok: true, plan: planFor([0]) });
    render(
      <PlansProvider plans={[]}>
        <ComingUp events={[khalid]} />
        <HomePlanCard target={targetFor(khalid)} />
      </PlansProvider>,
    );
    expect(screen.getByRole("heading", { name: "Khalid's birthday plan" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Plan/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Gift", pressed: false }));
    expect(planActions.startPlan).toHaveBeenCalledWith({
      occasionId: "o1",
      occursOn: "2026-11-06",
      tick: "gift",
    });
    expect(await screen.findByRole("button", { name: "Gift", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Plan 1 of 4 done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan their day" })).toBeInTheDocument();
  });

  it("ticking a step of an existing plan shows at once and rolls back if it fails", async () => {
    planActions.tickStep.mockResolvedValue({
      ok: false,
      message: "That didn't save. Please try again.",
    });
    render(
      <PlansProvider plans={[planFor([0])]}>
        <HomePlanCard target={targetFor(khalid)} />
      </PlansProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Message", pressed: false }));
    expect(await screen.findByText("That didn't save. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Message", pressed: false })).toBeInTheDocument();
  });

  it("someone in memory: gentle steps, nothing celebratory", () => {
    const grandma = upcoming([src({ name: "Grandma", inMemory: true })], today)[0]!;
    render(<HomePlanCard target={targetFor(grandma)} />);
    expect(screen.getByRole("button", { name: "Send a kind word" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gift" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cake" })).not.toBeInTheDocument();
  });
});
