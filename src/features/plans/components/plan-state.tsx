"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import {
  addStep,
  type PlanResult,
  removeStep,
  renameStep,
  saveNote,
  startPlan,
  tickStep,
} from "../actions";
import { byKey, keyOf, type PlanTarget, type PlanView, type StepKind } from "../steps";

type PlansContextValue = {
  plans: Map<string, PlanView>;
  setPlan: (plan: PlanView) => void;
};

const PlansContext = React.createContext<PlansContextValue | null>(null);

/**
 * Your plans on a page (Home, People, Celebrate Me), so the dots, the card
 * and the sheet all show the same thing as soon as a step is ticked. Fresh
 * server data (after `router.refresh()`) replaces it.
 */
export function PlansProvider({
  plans: initial,
  children,
}: {
  plans: PlanView[];
  children: React.ReactNode;
}) {
  const [plans, setPlans] = React.useState(() => byKey(initial));
  const [source, setSource] = React.useState(initial);
  if (source !== initial) {
    // New server data: start from it (React's "adjust state on prop change").
    setSource(initial);
    setPlans(byKey(initial));
  }
  const setPlan = React.useCallback((plan: PlanView) => {
    setPlans((current) => new Map(current).set(keyOf(plan), plan));
  }, []);
  const value = React.useMemo(() => ({ plans, setPlan }), [plans, setPlan]);
  return <PlansContext value={value}>{children}</PlansContext>;
}

const NO_PLANS: PlansContextValue = { plans: new Map(), setPlan: () => {} };

/** The page's plans (none outside a PlansProvider, e.g. in isolated tests). */
export function usePlans() {
  return React.useContext(PlansContext) ?? NO_PLANS;
}

export function usePlan(key: string): PlanView | null {
  return usePlans().plans.get(key) ?? null;
}

/**
 * Everything you can do to one plan. A plan that doesn't exist yet is made
 * on the first change (opening it changes nothing). Ticks show at once and
 * roll back if saving fails. `message` is for an aria-live status line.
 */
export function usePlanActions(target: PlanTarget) {
  const router = useRouter();
  const { plans, setPlan } = usePlans();
  const plan = plans.get(target.key) ?? null;
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const settle = React.useCallback(
    (result: PlanResult, success?: string) => {
      if (!result.ok) {
        setMessage(result.message);
        return null;
      }
      setPlan(result.plan);
      setMessage(success ?? "");
      // The sidebar's "Your day" card shows your own plan: it lives in the layout.
      if (result.plan.occasionId === null) router.refresh();
      return result.plan;
    },
    [router, setPlan],
  );

  const start = React.useCallback(
    async (tick?: StepKind) =>
      settle(
        await startPlan({ occasionId: target.occasionId, occursOn: target.occursOn, tick }),
        tick ? "Ticked" : undefined,
      ),
    [settle, target.occasionId, target.occursOn],
  );

  /** The plan, made now if needed. */
  const ensure = React.useCallback(async () => plan ?? (await start()), [plan, start]);

  /** A step of the real plan for a (possibly suggested) step: same kind and label. */
  const realStep = (real: PlanView, step: { id: string; kind: StepKind; label: string }) =>
    real.steps.find((s) => s.id === step.id) ??
    real.steps.find((s) => s.kind === step.kind && s.label === step.label) ??
    null;

  const run = async <T,>(fn: () => Promise<T>) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };

  return {
    plan,
    busy,
    message,
    setMessage,
    async toggle(step: { id: string; kind: StepKind; label: string; done: boolean }) {
      const done = !step.done;
      if (!plan) {
        // Ticking a suggestion starts the plan with that step ticked.
        if (done) return run(() => start(step.kind));
        return null;
      }
      const before = plan;
      setPlan({
        ...plan,
        steps: plan.steps.map((s) => (s.id === step.id ? { ...s, done, byReservation: false } : s)),
      });
      const result = await tickStep({ stepId: step.id, done });
      if (!result.ok) setPlan(before);
      return settle(result, done ? `${step.label}: done` : `${step.label}: not done`);
    },
    rename: (step: { id: string; kind: StepKind; label: string }, label: string) =>
      run(async () => {
        const real = await ensure();
        const target = real && realStep(real, step);
        if (!target) return null;
        return settle(await renameStep({ stepId: target.id, label }), "Saved");
      }),
    remove: (step: { id: string; kind: StepKind; label: string }) =>
      run(async () => {
        const real = await ensure();
        const target = real && realStep(real, step);
        if (!target) return null;
        return settle(await removeStep(target.id), `${step.label} removed`);
      }),
    add: (kind: StepKind, label: string) =>
      run(async () => {
        const real = await ensure();
        if (!real) return null;
        return settle(await addStep({ planId: real.id, kind, label }), `${label} added`);
      }),
    saveNote: (note: string) =>
      run(async () => {
        const real = await ensure();
        if (!real) return null;
        return settle(await saveNote({ planId: real.id, note }), "Note saved");
      }),
  };
}
