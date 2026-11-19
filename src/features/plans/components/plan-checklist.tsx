"use client";

import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { fieldInputClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { MAX_LABEL, type PlanStep, STEP_EMOJI } from "../steps";

type Actions = {
  toggle: (step: PlanStep) => unknown;
  rename?: (step: PlanStep, label: string) => Promise<unknown>;
  remove?: (step: PlanStep) => Promise<unknown>;
};

/**
 * A plan's steps (AppCelebrate "My plan"): each a real checkbox button with
 * its emoji, crossed out when done. With `rename`/`remove`, each step also
 * gets "Rename" and "Remove" buttons.
 */
export function PlanChecklist({
  steps,
  busy,
  labelledBy,
  ...actions
}: Actions & { steps: PlanStep[]; busy?: boolean; labelledBy?: string }) {
  return (
    <ul aria-labelledby={labelledBy} className="flex flex-col gap-1">
      {steps.map((step) => (
        <StepRow key={step.id} step={step} busy={busy} {...actions} />
      ))}
    </ul>
  );
}

function StepRow({
  step,
  busy,
  toggle,
  rename,
  remove,
}: Actions & { step: PlanStep; busy?: boolean }) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(step.label);
  const inputId = React.useId();
  const editRef = React.useRef<HTMLButtonElement>(null);

  const finish = async (save: boolean) => {
    if (save && rename && value.trim() && value.trim() !== step.label) {
      await rename(step, value.trim());
    }
    setEditing(false);
    requestAnimationFrame(() => editRef.current?.focus());
  };

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-2 rounded-[16px] p-1.5">
        <label htmlFor={inputId} className="sr-only">
          Rename {step.label}
        </label>
        <input
          id={inputId}
          autoFocus
          value={value}
          maxLength={MAX_LABEL}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void finish(true);
            }
            if (e.key === "Escape") {
              // Cancel the rename, not the whole dialog.
              e.stopPropagation();
              e.preventDefault();
              setValue(step.label);
              void finish(false);
            }
          }}
          className={cn(fieldInputClass, "h-11 min-w-0 flex-1 basis-40")}
        />
        <Button size="default" disabled={busy || !value.trim()} onClick={() => void finish(true)}>
          Save
        </Button>
        <Button
          variant="transparent"
          onClick={() => {
            setValue(step.label);
            void finish(false);
          }}
        >
          Cancel
        </Button>
      </li>
    );
  }

  return (
    <li className="flex min-w-0 items-center gap-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={step.done}
        onClick={() => void toggle(step)}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[16px] p-2.5 text-left transition-colors duration-200 ease-soft hover-tint"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-[26px] shrink-0 items-center justify-center rounded-[8px] border-2 transition-colors duration-200",
            step.done ? "border-accent bg-accent text-on-accent" : "border-line bg-transparent",
          )}
        >
          {step.done && <CheckIcon className="size-4" strokeWidth={3} />}
        </span>
        <span aria-hidden className="text-[20px]">
          {STEP_EMOJI[step.kind]}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 text-15 font-semibold [overflow-wrap:anywhere]",
            step.done && "text-sub line-through",
          )}
        >
          {step.label}
        </span>
      </button>
      {rename && (
        <Button
          ref={editRef}
          variant="transparent"
          size="icon"
          disabled={busy}
          onClick={() => {
            setValue(step.label);
            setEditing(true);
          }}
        >
          <PencilIcon aria-hidden className="size-[18px]" />
          <span className="sr-only">Rename {step.label}</span>
        </Button>
      )}
      {remove && (
        <Button variant="transparent" size="icon" disabled={busy} onClick={() => void remove(step)}>
          <XIcon aria-hidden className="size-[18px]" />
          <span className="sr-only">Remove {step.label}</span>
        </Button>
      )}
    </li>
  );
}
