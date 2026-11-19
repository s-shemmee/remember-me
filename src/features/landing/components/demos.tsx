"use client";

import * as React from "react";

import { Noor } from "@/components/ui/noor";
import { pastelClasses } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

import { DEMO_PLAN, DEMO_PLAN_NOOR, DEMO_REMINDERS } from "../content";

/**
 * Feature 01: example reminders as a stack of notifications. No autoplay
 * (WCAG 2.2.2): "Next" (or a tap on the stack) brings the next one forward,
 * and the new one is announced.
 */
export function ReminderStack() {
  const [front, setFront] = React.useState(0);
  const n = DEMO_REMINDERS.length;
  const next = () => setFront((f) => (f + 1) % n);
  const current = DEMO_REMINDERS[front]!;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="relative h-[140px]" onClick={next}>
        {DEMO_REMINDERS.map((card, i) => {
          const rel = (i - front + n) % n;
          const style =
            rel === 0
              ? "z-[5] translate-y-0 scale-100 opacity-100"
              : rel === 1
                ? "z-[4] translate-y-4 scale-95 opacity-85"
                : rel === 2
                  ? "z-[3] translate-y-8 scale-90 opacity-55"
                  : rel === n - 1
                    ? "z-[6] -translate-y-8 scale-[1.02] -rotate-3 opacity-0"
                    : "z-[1] translate-y-11 scale-[.86] opacity-0";
          return (
            <div
              key={card.title}
              aria-hidden
              className={cn(
                "absolute inset-x-0 top-0 flex origin-top gap-3 rounded-[22px] bg-card/90 px-4 py-3.5 font-system text-text shadow-[0_10px_28px_rgba(0,0,0,.10)] transition-[translate,scale,rotate,opacity] duration-500 ease-soft",
                style,
              )}
            >
              <span
                className={cn(
                  "grid size-[38px] shrink-0 place-items-center rounded-[10px] text-[20px]",
                  pastelClasses[card.pastel],
                )}
              >
                {card.emoji}
              </span>
              <span className="flex min-w-0 grow flex-col gap-px">
                <span className="flex justify-between text-12 font-semibold text-sub">
                  <span>REMEMBER ME</span>
                  <span>{card.when}</span>
                </span>
                <span className="truncate text-15 font-bold">{card.title}</span>
                <span className="truncate text-14 text-sub">{card.line}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        Example reminder {front + 1} of {n}: {current.title}. {current.line}
      </p>
      <div className="flex items-center justify-between text-peach-ink">
        <span aria-hidden className="flex gap-1.5">
          {DEMO_REMINDERS.map((card, i) => (
            <span
              key={card.title}
              className={cn(
                "h-[7px] rounded-pill bg-current transition-[width,opacity] duration-300",
                i === front ? "w-[22px]" : "w-[7px] opacity-35",
              )}
            />
          ))}
        </span>
        <button
          type="button"
          onClick={next}
          className="inline-flex min-h-11 items-center rounded-pill bg-glass hover-tint px-4 text-14 font-semibold text-text transition-transform duration-200 ease-soft hover:-translate-y-px active:scale-[.97]"
        >
          Next reminder
        </button>
      </div>
    </div>
  );
}

/**
 * Feature 02: an example plan you can tick (nothing is saved). The steps are
 * the app's real suggestions; Noor cheers you on.
 */
export function PlanDemo() {
  const [done, setDone] = React.useState<boolean[]>([true, true, false, false]);
  const count = done.filter(Boolean).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-card text-15 font-extrabold text-text">
          SA
        </span>
        <span className="flex flex-col">
          <span className="text-17 font-bold">Sara&apos;s birthday plan</span>
          <span className="text-14">
            Tue, 3 Mar · {count} of {DEMO_PLAN.length} done
          </span>
        </span>
      </div>
      <ul className="grid grid-cols-4 gap-2" aria-label="Example plan steps">
        {DEMO_PLAN.map((step, i) => (
          <li key={step.label} className="flex flex-col items-center gap-2">
            <button
              type="button"
              aria-pressed={done[i]}
              aria-label={step.label}
              onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
              className={cn(
                "grid size-[60px] place-items-center rounded-full hover-tint text-[26px] transition-[background-color,box-shadow,transform] duration-200 ease-soft hover:-translate-y-px active:scale-[.97]",
                done[i]
                  ? "bg-card shadow-[0_8px_18px_rgba(91,63,181,.22)]"
                  : "bg-card/40 shadow-[inset_0_0_0_2px_var(--lilac-ink)]",
              )}
            >
              <span aria-hidden>{done[i] ? step.emoji : "○"}</span>
            </button>
            <span aria-hidden className="text-13 font-bold">
              {step.label}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-end gap-2">
        <Noor size={36} />
        <p
          aria-live="polite"
          className="rounded-[18px_18px_18px_5px] bg-card px-3 py-2 font-system text-15 text-text"
        >
          {DEMO_PLAN_NOOR[count]}
        </p>
      </div>
    </div>
  );
}
