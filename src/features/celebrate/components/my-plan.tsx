"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Noor } from "@/components/ui/noor";
import { PlanChecklist } from "@/features/plans/components/plan-checklist";
import { PlanSheet } from "@/features/plans/components/plan-sheet";
import { usePlan, usePlanActions } from "@/features/plans/components/plan-state";
import { type PlanTarget, previewSteps, progress } from "@/features/plans/steps";

import { NOTE_OPENS_LINE, noorPlanLine } from "../countdown";

/**
 * "My plan" (AppCelebrate): your own day's checklist. Tick straight here;
 * "Edit my plan" opens the whole plan (rename, remove, add, a note).
 */
export function MyPlanCard({ target }: { target: PlanTarget }) {
  const actions = usePlanActions(target);
  const { plan, busy, message } = actions;
  const steps = plan?.steps ?? previewSteps("own");
  const { done, total } = progress({ steps });
  const [open, setOpen] = React.useState(false);

  return (
    <section
      aria-labelledby="my-plan"
      className="flex min-w-0 flex-col gap-3 rounded-[28px] bg-card p-[22px] shadow-card"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="my-plan" className="text-[18px] font-extrabold">
          My plan
        </h2>
        <span className="text-13 font-bold text-rose-ink">
          {done} of {total}
        </span>
      </div>
      <div aria-hidden className="h-2 overflow-hidden rounded-pill bg-card2">
        <div
          className="h-full rounded-pill bg-accent transition-[width] duration-400 ease-soft motion-reduce:transition-none"
          style={{ width: total ? `${Math.round((done / total) * 100)}%` : "0%" }}
        />
      </div>
      <PlanChecklist
        steps={steps}
        busy={busy}
        labelledBy="my-plan"
        toggle={(step) => actions.toggle(step)}
      />
      <p role="status" aria-live="polite" className="text-13 font-semibold text-sub empty:hidden">
        {message}
      </p>
      <Button variant="card2" onClick={() => setOpen(true)} className="self-start">
        Edit my plan
      </Button>
      <PlanSheet target={target} open={open} onOpenChange={setOpen} />
    </section>
  );
}

/**
 * Noor on the countdown: the line for the stage, then how your plan is going
 * (or, on the day a sealed note opens, that it's waiting). Changing lines are
 * announced politely.
 */
export function CelebrateNoor({
  stageLine,
  target,
  noteOpensToday,
}: {
  stageLine: string;
  target: PlanTarget | null;
  noteOpensToday: boolean;
}) {
  const plan = usePlan(target?.key ?? "");
  const steps = plan?.steps ?? previewSteps("own");
  const { done, total } = progress({ steps });
  const second = noteOpensToday ? NOTE_OPENS_LINE : target ? noorPlanLine(done, total) : null;
  return (
    <div className="flex min-w-0 flex-[1_1_300px] items-end gap-3">
      <Noor size={86} animated className="shrink-0" />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="self-start rounded-[22px_22px_22px_6px] bg-card px-4 py-3 text-15 leading-snug text-text shadow-card">
          {stageLine}
        </p>
        {second && (
          <p
            aria-live="polite"
            className="self-start rounded-[22px_22px_22px_6px] bg-card px-4 py-3 text-15 leading-snug text-text shadow-card"
          >
            {second}
          </p>
        )}
      </div>
    </div>
  );
}
