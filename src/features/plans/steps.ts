/**
 * Birthday plans (docs/decisions.md, "Celebrate Me and birthday plans").
 * Pure: shared by Home, People and Celebrate Me, and unit-tested.
 *
 * A plan belongs to one year's occurrence of a day (`occasionId` +
 * `occursOn`), or to your own birthday (`occasionId` null). Next year's
 * occurrence is a different key, so each year starts fresh while past plans
 * stay. The suggested steps are the same list as public.plan_suggestions().
 */
import type { DayEvent } from "@/features/days/days";
import type { CalendarDate } from "@/lib/dates";
import { toIsoDate } from "@/lib/dates";
import type { Pastel } from "@/styles/tokens";

export type StepKind =
  "gift" | "message" | "call" | "cake" | "kind_word" | "visit" | "friends" | "treat" | "other";

/** Celebratory, gentle (Remembrance or "In memory": nothing celebratory), or your own day. */
export type PlanStyle = "celebrate" | "gentle" | "own";

export const STEP_EMOJI: Record<StepKind, string> = {
  gift: "🎁",
  message: "💌",
  call: "📞",
  cake: "🎂",
  kind_word: "🕊️",
  visit: "🌿",
  friends: "🥂",
  treat: "🎁",
  other: "✨",
};

export type Suggestion = { kind: StepKind; label: string };

export const SUGGESTIONS: Record<PlanStyle, Suggestion[]> = {
  celebrate: [
    { kind: "gift", label: "Gift" },
    { kind: "message", label: "Message" },
    { kind: "call", label: "Call" },
    { kind: "cake", label: "Cake" },
    { kind: "other", label: "Something else" },
  ],
  gentle: [
    { kind: "kind_word", label: "Send a kind word" },
    { kind: "call", label: "Call them" },
    { kind: "visit", label: "Visit" },
  ],
  own: [
    { kind: "friends", label: "Plan something with friends" },
    { kind: "cake", label: "Cake" },
    { kind: "treat", label: "Treat yourself" },
    { kind: "other", label: "Something just for me" },
  ],
};

export const MAX_STEPS = 12;
export const MAX_LABEL = 60;
export const MAX_NOTE = 280;

export const styleFor = (day: { isYou: boolean; gentle: boolean }): PlanStyle =>
  day.isYou ? "own" : day.gentle ? "gentle" : "celebrate";

export type PlanStep = {
  id: string;
  kind: StepKind;
  label: string;
  position: number;
  done: boolean;
  /** Ticked by reserving a gift (cancelling the reservation unticks it). */
  byReservation: boolean;
  /** The message chosen for this step ("Use in plan" from Noor's drafts). */
  message?: string | null;
};

export type PlanView = {
  id: string;
  /** Null: your own birthday. */
  occasionId: string | null;
  /** "2026-11-22": the occurrence this plan is for. */
  occursOn: string;
  note: string;
  steps: PlanStep[];
};

/** "<occasion id or you>|<date>": one plan per occurrence. */
export const planKey = (occasionId: string | null, occursOn: CalendarDate | string) =>
  `${occasionId ?? "you"}|${typeof occursOn === "string" ? occursOn : toIsoDate(occursOn)}`;

export const keyOf = (plan: Pick<PlanView, "occasionId" | "occursOn">) =>
  planKey(plan.occasionId, plan.occursOn);

/** The plans by key, for looking up the plan of an occurrence. */
export function byKey(plans: PlanView[]): Map<string, PlanView> {
  return new Map(plans.map((p) => [keyOf(p), p]));
}

export function progress(plan: Pick<PlanView, "steps"> | null | undefined) {
  const steps = plan?.steps ?? [];
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}

/** "Plan 2 of 4 done", for the dots' label. */
export function planLabel(plan: Pick<PlanView, "steps">): string {
  const { done, total } = progress(plan);
  return `Plan ${done} of ${total} done`;
}

/**
 * The plan's dots: one per step, in the plan's order (the same steps, in the
 * same order, as the plan card's ticks), at most `max`; `more` counts the
 * steps past them. Never scaled: a ticked step is always a filled dot.
 */
export function planDots(
  plan: Pick<PlanView, "steps">,
  max = 5,
): { dots: boolean[]; more: number } {
  const steps = sortedSteps(plan.steps);
  return { dots: steps.slice(0, max).map((s) => s.done), more: Math.max(0, steps.length - max) };
}

/**
 * The step "Use in plan" writes a message to: the one asked for, else the
 * plan's Message step (an unticked one first, else the first one, ticked or
 * not). Undefined only when the plan has no Message step: then add one.
 * Never a second Message step next to a ticked one.
 */
export function messageStepFor(steps: PlanStep[], stepId: string | null): PlanStep | undefined {
  if (stepId) return steps.find((s) => s.id === stepId);
  const messages = sortedSteps(steps).filter((s) => s.kind === "message");
  return messages.find((s) => !s.done) ?? messages[0];
}

/** Steps in order. */
export const sortedSteps = (steps: PlanStep[]) =>
  [...steps].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label));

/**
 * What a plan card shows before a plan exists: the suggestions, none done
 * (ids are placeholders; ticking one starts the plan).
 */
export function previewSteps(style: PlanStyle): PlanStep[] {
  return SUGGESTIONS[style].map((s, i) => ({
    id: `suggested-${s.kind}-${i}`,
    kind: s.kind,
    label: s.label,
    position: i,
    done: false,
    byReservation: false,
  }));
}

/** Past plans of one day (earlier occurrences), newest first: they stay on the person's profile. */
export function pastPlans(
  plans: PlanView[],
  occasionIds: string[],
  today: CalendarDate | string,
): PlanView[] {
  const ids = new Set(occasionIds);
  const iso = typeof today === "string" ? today : toIsoDate(today);
  return plans
    .filter((p) => p.occasionId && ids.has(p.occasionId) && p.occursOn < iso)
    .sort((a, b) => b.occursOn.localeCompare(a.occursOn));
}

/** The next step position after the last one. */
export const nextPosition = (steps: PlanStep[]) =>
  Math.min(99, steps.reduce((max, s) => Math.max(max, s.position), -1) + 1);

/** What a plan is for: one occurrence of a day, with what the sheet and card show. */
export type PlanTarget = {
  /** The key: `planKey(occasionId, occursOn)`. */
  key: string;
  /** Null: your own birthday. */
  occasionId: string | null;
  /** "2026-11-22". */
  occursOn: string;
  /** "Khalid's birthday plan", "Plan for Grandma's day of remembrance", "My plan". */
  heading: string;
  /** "Fri, 6 Nov". */
  date: string;
  name: string;
  color: Pastel;
  style: PlanStyle;
};

/** The plan target of an upcoming day (Home, People and Celebrate Me). */
export function targetFor(e: DayEvent): PlanTarget {
  const occasionId = e.source.isYou ? null : e.source.id;
  const occursOn = toIsoDate(e.on);
  return {
    key: planKey(occasionId, occursOn),
    occasionId,
    occursOn,
    heading: e.source.isYou
      ? "My plan"
      : e.source.kind === "birthday" && !e.gentle
        ? `${e.title} plan`
        : `Plan for ${e.title}`,
    date: e.shortDate,
    name: e.source.name,
    color: e.source.color,
    style: styleFor({ isYou: e.source.isYou, gentle: e.gentle }),
  };
}

/**
 * "Add to their plan" from a gift idea: rename the first unticked Gift step
 * to the idea (so the plan never holds two gifts to pick), or add a new,
 * unticked Gift step when there's none or the gift is already ticked.
 */
export function giftIdeaStep(
  steps: PlanStep[],
): { action: "rename"; stepId: string } | { action: "add" } {
  const open = sortedSteps(steps).find((s) => s.kind === "gift" && !s.done);
  return open ? { action: "rename", stepId: open.id } : { action: "add" };
}
