"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { loadPlan } from "./load";
import {
  addStepSchema,
  noteSchema,
  renameStepSchema,
  startPlanSchema,
  tickStepSchema,
} from "./schema";
import { nextPosition, type PlanView } from "./steps";
import { z } from "zod";

export type PlanResult = { ok: true; plan: PlanView } | { ok: false; message: string };

const OOPS = "That didn't save. Please try again.";

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/log-in?next=%2Fhome");
  return supabase;
}

type Supabase = Awaited<ReturnType<typeof signedIn>>;

/** The plan a step belongs to (RLS: yours only), reloaded after a change. */
async function planOfStep(supabase: Supabase, stepId: string): Promise<PlanResult> {
  const { data } = await supabase
    .from("plan_steps")
    .select("plan_id")
    .eq("id", stepId)
    .maybeSingle();
  const plan = data ? await loadPlan(supabase, data.plan_id) : null;
  return plan ? { ok: true, plan } : { ok: false, message: OOPS };
}

async function reload(supabase: Supabase, planId: string): Promise<PlanResult> {
  const plan = await loadPlan(supabase, planId);
  return plan ? { ok: true, plan } : { ok: false, message: OOPS };
}

/**
 * "Plan their day" / "My plan": opens the plan for one occurrence, making it
 * (with the suggested steps) if it's new. The database checks the day is
 * yours and that the date is a real occurrence.
 */
export async function startPlan(input: unknown): Promise<PlanResult> {
  const supabase = await signedIn();
  const parsed = startPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: OOPS };
  const { data: planId, error } = await supabase.rpc("start_plan", {
    // A null occasion is your own birthday (the generated type doesn't know it's nullable).
    p_occasion_id: parsed.data.occasionId as string,
    p_occurs_on: parsed.data.occursOn,
  });
  if (error || !planId) {
    if (error?.message === "no_birthday") {
      return { ok: false, message: "Add your birthday in your profile first." };
    }
    return { ok: false, message: OOPS };
  }
  if (parsed.data.tick) {
    await supabase
      .from("plan_steps")
      .update({ done_at: new Date().toISOString(), ticked_by: "me" })
      .eq("plan_id", planId)
      .eq("kind", parsed.data.tick)
      .is("done_at", null);
  }
  return reload(supabase, planId);
}

export async function tickStep(input: unknown): Promise<PlanResult> {
  const supabase = await signedIn();
  const parsed = tickStepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: OOPS };
  const { error } = await supabase
    .from("plan_steps")
    .update(
      parsed.data.done
        ? { done_at: new Date().toISOString(), ticked_by: "me" }
        : { done_at: null, ticked_by: null },
    )
    .eq("id", parsed.data.stepId);
  if (error) return { ok: false, message: OOPS };
  return planOfStep(supabase, parsed.data.stepId);
}

export async function renameStep(input: unknown): Promise<PlanResult> {
  const supabase = await signedIn();
  const parsed = renameStepSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? OOPS };
  }
  const { error } = await supabase
    .from("plan_steps")
    .update({ label: parsed.data.label })
    .eq("id", parsed.data.stepId);
  if (error) return { ok: false, message: OOPS };
  return planOfStep(supabase, parsed.data.stepId);
}

export async function removeStep(stepId: unknown): Promise<PlanResult> {
  const supabase = await signedIn();
  const parsed = z.uuid().safeParse(stepId);
  if (!parsed.success) return { ok: false, message: OOPS };
  const { data } = await supabase
    .from("plan_steps")
    .select("plan_id")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!data) return { ok: false, message: OOPS };
  const { error } = await supabase.from("plan_steps").delete().eq("id", parsed.data);
  if (error) return { ok: false, message: OOPS };
  return reload(supabase, data.plan_id);
}

export async function addStep(input: unknown): Promise<PlanResult> {
  const supabase = await signedIn();
  const parsed = addStepSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? OOPS };
  }
  const current = await loadPlan(supabase, parsed.data.planId);
  if (!current) return { ok: false, message: OOPS };
  const { error } = await supabase.from("plan_steps").insert({
    plan_id: current.id,
    kind: parsed.data.kind,
    label: parsed.data.label,
    position: nextPosition(current.steps),
  });
  if (error) {
    if (error.message.includes("too_many_steps")) {
      return { ok: false, message: "A plan holds 12 steps. Remove one to add another." };
    }
    return { ok: false, message: OOPS };
  }
  return reload(supabase, current.id);
}

export async function saveNote(input: unknown): Promise<PlanResult> {
  const supabase = await signedIn();
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? OOPS };
  }
  const { error } = await supabase
    .from("plans")
    .update({ note: parsed.data.note || null })
    .eq("id", parsed.data.planId);
  if (error) return { ok: false, message: OOPS };
  return reload(supabase, parsed.data.planId);
}
