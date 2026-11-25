import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as React from "react";

import type { PlanTarget, PlanView } from "../steps";
import { PlanSheet } from "./plan-sheet";
import { PlansProvider } from "./plan-state";

const actions = vi.hoisted(() => ({
  startPlan: vi.fn(),
  tickStep: vi.fn(),
  renameStep: vi.fn(),
  removeStep: vi.fn(),
  addStep: vi.fn(),
  saveNote: vi.fn(),
}));
vi.mock("../actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const target: PlanTarget = {
  key: "o1|2026-11-06",
  occasionId: "o1",
  occursOn: "2026-11-06",
  heading: "Khalid's birthday plan",
  date: "Fri, 6 Nov",
  name: "Khalid",
  color: "butter",
  style: "celebrate",
};
const made = (labels: string[], note = ""): PlanView => ({
  id: PLAN_ID,
  occasionId: "o1",
  occursOn: "2026-11-06",
  note,
  steps: labels.map((label, i) => ({
    id: `2222222${i}-2222-4222-8222-222222222222`,
    kind: label === "Gift" ? "gift" : label === "Cake" ? "cake" : "other",
    label,
    position: i,
    done: false,
    byReservation: false,
  })),
});

function open(plans: PlanView[] = [], t = target) {
  return render(
    <PlansProvider plans={plans}>
      <PlanSheet target={t} open onOpenChange={() => {}} />
    </PlansProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("the plan sheet", () => {
  it("shows the suggestions before a plan exists, and says it's private", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "Khalid's birthday plan" });
    expect(within(dialog).getByText(/Only you can see this plan/)).toBeInTheDocument();
    for (const label of ["Gift", "Message", "Call", "Cake", "Something else"]) {
      expect(within(dialog).getByRole("checkbox", { name: new RegExp(label) })).toBeInTheDocument();
    }
    // Opening it changes nothing.
    expect(actions.startPlan).not.toHaveBeenCalled();
  });

  it("renaming a suggestion starts the plan, then renames that step", async () => {
    actions.startPlan.mockResolvedValue({
      ok: true,
      plan: made(["Gift", "Message", "Call", "Cake", "Something else"]),
    });
    actions.renameStep.mockResolvedValue({
      ok: true,
      plan: made(["Gift", "Message", "Call", "Fig cake", "Something else"]),
    });
    open();
    await userEvent.click(screen.getByRole("button", { name: "Rename Cake" }));
    const input = screen.getByRole("textbox", { name: "Rename Cake" });
    await userEvent.clear(input);
    await userEvent.type(input, "Fig cake{Enter}");
    expect(actions.startPlan).toHaveBeenCalledWith({
      occasionId: "o1",
      occursOn: "2026-11-06",
      tick: undefined,
    });
    expect(actions.renameStep).toHaveBeenCalledWith({
      stepId: "22222223-2222-4222-8222-222222222222",
      label: "Fig cake",
    });
    expect(await screen.findByRole("checkbox", { name: /Fig cake/ })).toBeInTheDocument();
  });

  it("Escape cancels a rename without closing the plan", async () => {
    open([made(["Gift"])]);
    await userEvent.click(screen.getByRole("button", { name: "Rename Gift" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Rename Gift" })).toHaveFocus());
    expect(actions.renameStep).not.toHaveBeenCalled();
  });

  it("removed suggestions come back as ideas; your own steps can be added", async () => {
    actions.addStep.mockResolvedValue({ ok: true, plan: made(["Gift", "Book the rooftop"]) });
    open([made(["Gift"])]);
    expect(screen.getByRole("button", { name: /Add Cake/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add Gift/ })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Add a step" }), "Book the rooftop");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(actions.addStep).toHaveBeenCalledWith({
      planId: PLAN_ID,
      kind: "other",
      label: "Book the rooftop",
    });
    expect(await screen.findByText("Book the rooftop added")).toBeInTheDocument();
  });

  it("removes a step and saves a short note", async () => {
    actions.removeStep.mockResolvedValue({ ok: true, plan: made(["Gift"]) });
    actions.saveNote.mockResolvedValue({ ok: true, plan: made(["Gift"], "Rooftop at sunset") });
    open([made(["Gift", "Cake"])]);
    await userEvent.click(screen.getByRole("button", { name: "Remove Cake" }));
    expect(actions.removeStep).toHaveBeenCalledWith("22222221-2222-4222-8222-222222222222");
    await userEvent.type(
      screen.getByRole("textbox", { name: "A short note" }),
      "Rooftop at sunset",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(actions.saveNote).toHaveBeenCalledWith({ planId: PLAN_ID, note: "Rooftop at sunset" });
    expect(await screen.findByText("Note saved")).toBeInTheDocument();
  });

  it("a gentle day offers gentle ideas only", () => {
    open([], { ...target, style: "gentle", heading: "Plan for Grandma's birthday" });
    expect(screen.getByRole("checkbox", { name: /Send a kind word/ })).toBeInTheDocument();
    expect(screen.queryByText(/Gift|Cake/)).not.toBeInTheDocument();
  });

  it("Escape closes it and focus goes back to what opened it", async () => {
    function Opener() {
      const [isOpen, setOpen] = React.useState(false);
      return (
        <PlansProvider plans={[]}>
          <button type="button" onClick={() => setOpen(true)}>
            Plan their day
          </button>
          <PlanSheet target={target} open={isOpen} onOpenChange={setOpen} />
        </PlansProvider>
      );
    }
    render(<Opener />);
    const button = screen.getByRole("button", { name: "Plan their day" });
    await userEvent.click(button);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  });
});
