import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

import type { PlanView, StepKind } from "./steps";
import { sortedSteps } from "./steps";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const PLAN_COLUMNS =
  "id, occasion_id, occurs_on, note, plan_steps(id, kind, label, position, done_at, ticked_by)";

type PlanRow = {
  id: string;
  occasion_id: string | null;
  occurs_on: string;
  note: string | null;
  plan_steps: {
    id: string;
    kind: string;
    label: string;
    position: number;
    done_at: string | null;
    ticked_by: string | null;
  }[];
};

export function toPlanView(row: PlanRow): PlanView {
  return {
    id: row.id,
    occasionId: row.occasion_id,
    occursOn: row.occurs_on,
    note: row.note ?? "",
    steps: sortedSteps(
      row.plan_steps.map((s) => ({
        id: s.id,
        kind: s.kind as StepKind,
        label: s.label,
        position: s.position,
        done: s.done_at !== null,
        byReservation: s.ticked_by === "reservation",
      })),
    ),
  };
}

/**
 * Your plans (RLS: only ever your own), optionally from a date on
 * ("2026-11-16"), or only those for your own birthday.
 */
export async function loadPlans(
  supabase: Supabase,
  { from, ownDayOnly = false }: { from?: string; ownDayOnly?: boolean } = {},
): Promise<PlanView[]> {
  let query = supabase.from("plans").select(PLAN_COLUMNS).order("occurs_on");
  if (from) query = query.gte("occurs_on", from);
  if (ownDayOnly) query = query.is("occasion_id", null);
  const { data } = await query;
  return ((data ?? []) as PlanRow[]).map(toPlanView);
}

export async function loadPlan(supabase: Supabase, id: string): Promise<PlanView | null> {
  const { data } = await supabase.from("plans").select(PLAN_COLUMNS).eq("id", id).maybeSingle();
  return data ? toPlanView(data as PlanRow) : null;
}
