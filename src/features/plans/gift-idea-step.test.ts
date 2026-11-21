import { describe, expect, it } from "vitest";

import { giftIdeaStep, type PlanStep } from "./steps";

const step = (over: Partial<PlanStep>): PlanStep => ({
  id: "s",
  kind: "message",
  label: "Write a message",
  position: 0,
  done: false,
  byReservation: false,
  ...over,
});

describe("giftIdeaStep: 'Add to their plan' from a gift idea", () => {
  it("renames the unticked Gift step instead of adding a second one", () => {
    const steps = [
      step({ id: "msg", position: 0 }),
      step({ id: "gift", kind: "gift", label: "Pick a gift", position: 1 }),
    ];
    expect(giftIdeaStep(steps)).toEqual({ action: "rename", stepId: "gift" });
  });

  it("adds a new Gift step when the plan has none", () => {
    expect(giftIdeaStep([step({ id: "msg" })])).toEqual({ action: "add" });
    expect(giftIdeaStep([])).toEqual({ action: "add" });
  });

  it("adds a new Gift step when the existing one is already ticked", () => {
    const steps = [step({ id: "gift", kind: "gift", done: true })];
    expect(giftIdeaStep(steps)).toEqual({ action: "add" });
  });

  it("renames the first unticked Gift step, skipping a ticked one", () => {
    const steps = [
      step({ id: "done", kind: "gift", done: true, position: 0 }),
      step({ id: "open", kind: "gift", position: 2 }),
    ];
    expect(giftIdeaStep(steps)).toEqual({ action: "rename", stepId: "open" });
  });
});
