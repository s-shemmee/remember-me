"use client";

import { PlusIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fieldInputClass, FieldLabel, FieldNote } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import {
  MAX_LABEL,
  MAX_NOTE,
  MAX_STEPS,
  type PlanTarget,
  previewSteps,
  progress,
  STEP_EMOJI,
  SUGGESTIONS,
} from "../steps";
import { PlanChecklist } from "./plan-checklist";
import { usePlanActions } from "./plan-state";

/**
 * "Plan their day": the whole plan in a dialog. Tick, rename, remove and
 * add steps (the suggestions you removed come back as chips), and a short
 * note. Private: only you ever see it. Opening it changes nothing; the plan
 * is made on the first change.
 */
export function PlanSheet({
  target,
  open,
  onOpenChange,
}: {
  target: PlanTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // No Radix trigger: remember what opened it, and give focus back on close.
  const opener = React.useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        onOpenAutoFocus={() => {
          opener.current = document.activeElement as HTMLElement | null;
        }}
        onCloseAutoFocus={(event) => {
          if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus();
          }
        }}
      >
        {open && <PlanSheetBody target={target} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PlanSheetBody({ target, onDone }: { target: PlanTarget; onDone: () => void }) {
  const actions = usePlanActions(target);
  const { plan, busy, message } = actions;
  const steps = plan?.steps ?? previewSteps(target.style);
  const { done, total } = progress({ steps });
  const missing = SUGGESTIONS[target.style].filter(
    (s) => !steps.some((step) => step.kind === s.kind && step.label === s.label),
  );
  const [label, setLabel] = React.useState("");
  const [note, setNote] = React.useState(plan?.note ?? "");
  const [savedNote, setSavedNote] = React.useState(plan?.note ?? "");
  const ids = React.useId();
  const full = steps.length >= MAX_STEPS;

  const addCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = label.trim();
    if (!value || full) return;
    if (await actions.add("other", value)) setLabel("");
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{target.heading}</DialogTitle>
        <DialogDescription>
          {target.date} · {done} of {total} done. Only you can see this plan.
        </DialogDescription>
      </DialogHeader>

      <div aria-hidden className="h-2 overflow-hidden rounded-pill bg-card2">
        <div
          className="h-full rounded-pill bg-accent transition-[width] duration-400 ease-soft motion-reduce:transition-none"
          style={{ width: total ? `${Math.round((done / total) * 100)}%` : "0%" }}
        />
      </div>

      <section aria-labelledby={`${ids}-steps`} className="flex flex-col gap-2">
        <h3 id={`${ids}-steps`} className="sr-only">
          Steps
        </h3>
        {steps.length ? (
          <PlanChecklist
            steps={steps}
            busy={busy}
            labelledBy={`${ids}-steps`}
            toggle={(step) => actions.toggle(step)}
            rename={(step, value) => actions.rename(step, value)}
            remove={(step) => actions.remove(step)}
          />
        ) : (
          <p className="text-14 text-sub">No steps yet. Add one below.</p>
        )}
      </section>

      {missing.length > 0 && !full && (
        <div className="flex flex-col gap-2">
          <p id={`${ids}-ideas`} className="text-13 font-semibold text-sub">
            Ideas
          </p>
          <ul aria-labelledby={`${ids}-ideas`} className="flex flex-wrap gap-1.5">
            {missing.map((s) => (
              <li key={s.kind + s.label}>
                <Button
                  variant="card2"
                  disabled={busy}
                  onClick={() => void actions.add(s.kind, s.label)}
                  className="px-4 text-14"
                >
                  <span aria-hidden>{STEP_EMOJI[s.kind]}</span> Add {s.label}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={addCustom} className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={`${ids}-add`}>Add a step</FieldLabel>
        <div className="flex gap-2">
          <input
            id={`${ids}-add`}
            value={label}
            maxLength={MAX_LABEL}
            disabled={full}
            aria-describedby={full ? `${ids}-add-note` : undefined}
            placeholder={
              target.style === "gentle" ? "e.g. Light a candle" : "e.g. Book the rooftop"
            }
            onChange={(e) => setLabel(e.target.value)}
            className={cn(fieldInputClass, "h-11 min-w-0 flex-1")}
          />
          <Button type="submit" variant="card2" disabled={busy || full || !label.trim()}>
            <PlusIcon aria-hidden /> Add
          </Button>
        </div>
        {full && (
          <FieldNote id={`${ids}-add-note`}>
            A plan holds {MAX_STEPS} steps. Remove one to add another.
          </FieldNote>
        )}
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void actions.saveNote(note).then((saved) => saved && setSavedNote(saved.note));
        }}
        className="flex flex-col gap-1.5"
      >
        <FieldLabel htmlFor={`${ids}-note`}>A short note</FieldLabel>
        <textarea
          id={`${ids}-note`}
          rows={3}
          value={note}
          maxLength={MAX_NOTE}
          aria-describedby={`${ids}-note-count`}
          placeholder={
            target.style === "gentle" ? "Something to remember" : "Ideas, sizes, who's coming…"
          }
          onChange={(e) => setNote(e.target.value)}
          className={cn(fieldInputClass, "h-auto resize-none py-3 leading-snug")}
        />
        <div className="flex items-center justify-between gap-3">
          <FieldNote id={`${ids}-note-count`}>
            {note.length} of {MAX_NOTE}
          </FieldNote>
          <Button type="submit" variant="card2" disabled={busy || note.trim() === savedNote.trim()}>
            Save note
          </Button>
        </div>
      </form>

      <p role="status" aria-live="polite" className="text-13 font-semibold text-sub empty:hidden">
        {message}
      </p>

      <div className="flex justify-end">
        <Button onClick={onDone}>Done</Button>
      </div>
    </>
  );
}
