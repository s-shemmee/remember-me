"use client";

import { CheckIcon } from "lucide-react";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { type PlanTarget, previewSteps, progress, sortedSteps, STEP_EMOJI } from "../steps";
import { PlanSheet } from "./plan-sheet";
import { usePlanActions } from "./plan-state";

/**
 * Home's plan card (AppHome, "Khalid's birthday plan"): the Next up day's
 * first four steps as big tickable pills, and "Plan their day", which opens
 * the whole plan. Before a plan exists it shows the suggestions; ticking one
 * starts the plan.
 */
export function HomePlanCard({ target }: { target: PlanTarget }) {
  const actions = usePlanActions(target);
  const { plan, message } = actions;
  // The same steps, in the same order, as the dots on Home's "Coming up".
  const steps = plan ? sortedSteps(plan.steps) : previewSteps(target.style);
  const { done, total } = progress({ steps });
  const [open, setOpen] = React.useState(false);
  const headingId = React.useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-4 rounded-[28px] bg-linear-160 from-lilac to-lilac-2 p-[22px] text-lilac-ink"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar
          name={target.name}
          pastel={target.color}
          src={target.look?.photoUrl}
          character={target.look?.character}
          decorative
          className={cn("size-[42px]", target.look?.character ? "text-[22px]" : "text-14")}
        />
        <div className="flex min-w-0 flex-col">
          <h2 id={headingId} className="truncate text-17 font-bold">
            {target.heading}
          </h2>
          <span className="text-13">
            {target.date} · {plan ? `${done} of ${total} done` : "no plan yet"}
          </span>
        </div>
      </div>

      <ul className="grid grid-cols-4 gap-1.5">
        {steps.slice(0, 4).map((step) => (
          <li key={step.id} className="flex min-w-0 flex-col items-center gap-1.5">
            <button
              type="button"
              aria-pressed={step.done}
              onClick={() => void actions.toggle(step)}
              className={cn(
                "relative flex size-[54px] items-center justify-center rounded-full hover-tint text-[23px] transition-[background-color,box-shadow,transform] duration-200 ease-soft hover:-translate-y-px active:scale-[.97] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                step.done
                  ? "bg-card shadow-[0_8px_18px_rgba(91,63,181,.22)]"
                  : "bg-card/40 shadow-[inset_0_0_0_2px_var(--lilac-ink)]",
              )}
            >
              <span aria-hidden="true">{STEP_EMOJI[step.kind]}</span>
              {step.done && (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-lilac-ink text-lilac"
                >
                  <CheckIcon className="size-3" strokeWidth={3} />
                </span>
              )}
              <span className="sr-only">{step.label}</span>
            </button>
            <span
              aria-hidden
              className="w-full text-center text-12 font-bold [overflow-wrap:anywhere]"
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>

      <p role="status" aria-live="polite" className="text-13 font-semibold empty:hidden">
        {message}
      </p>

      <Button
        variant="card2"
        onClick={() => setOpen(true)}
        className="self-start bg-card text-text"
      >
        {target.style === "gentle" ? "Plan the day" : "Plan their day"}
      </Button>
      <PlanSheet target={target} open={open} onOpenChange={setOpen} />
    </section>
  );
}
