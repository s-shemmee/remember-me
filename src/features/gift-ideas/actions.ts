"use server";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { aiMock, giftIdeasEnabled } from "@/ai/config";
import { nextGiftDay, type OccasionForGifts } from "@/ai/gift-ideas/prompt";
import { loadPlan } from "@/features/plans/load";
import { giftIdeaStep, nextPosition, type PlanView } from "@/features/plans/steps";
import { todayIn } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  addIdeaSchema,
  GIFT_REPLIES,
  giftFunctionResultSchema,
  giftIdeasRequestSchema,
  type GiftIdeasState,
  MOCK_IDEAS,
} from "./schema";

/**
 * Noor's gift ideas (a person's panel, and Home's nudge for the next
 * birthday). The Edge Function does the AI part and checks everything again;
 * here we check the user, the input, and that the person is yours (RLS) and
 * has a day coming that isn't gentle. Prompts and ideas are never logged.
 */

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/log-in?next=%2Fpeople");
  return { supabase, userId: userId as string };
}

type Supabase = Awaited<ReturnType<typeof signedIn>>["supabase"];

/** Yours (RLS), not "In memory", with a day coming that isn't gentle. */
async function canHaveIdeas(supabase: Supabase, userId: string, personId: string) {
  const [{ data: person }, { data: profile }] = await Promise.all([
    supabase
      .from("people")
      .select("in_memory, occasions (kind, day, month, year, recurring)")
      .eq("id", personId)
      .is("archived_at", null)
      .maybeSingle(),
    supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
  ]);
  if (!person) return false;
  return (
    nextGiftDay(
      (person.occasions ?? []) as OccasionForGifts[],
      todayIn(profile?.timezone),
      Boolean(person.in_memory),
    ) !== null
  );
}

/** The last ideas for this person, if any: free to reopen (no AI call). */
export async function savedGiftIdeas(input: unknown): Promise<GiftIdeasState | null> {
  if (!giftIdeasEnabled()) return null;
  const { supabase } = await signedIn();
  const parsed = giftIdeasRequestSchema.safeParse(input);
  if (!parsed.success) return null;
  const { data } = await supabase
    .from("gift_idea_results")
    .select("ideas, budget, created_at")
    .eq("person_id", parsed.data.personId)
    .maybeSingle();
  if (!data) return null;
  const result = giftFunctionResultSchema.safeParse({
    kind: "ideas",
    ideas: data.ideas,
    budget: data.budget,
    createdAt: data.created_at,
  });
  return result.success && result.data.kind === "ideas" ? result.data : null;
}

/** "Ask Noor for gift ideas" / "New ideas": uses one of today's 5. */
export async function newGiftIdeas(input: unknown): Promise<GiftIdeasState> {
  if (!giftIdeasEnabled()) return { kind: "message", tone: "info", text: GIFT_REPLIES.disabled };
  const { supabase, userId } = await signedIn();
  const parsed = giftIdeasRequestSchema.safeParse(input);
  if (!parsed.success) return { kind: "message", tone: "error", text: GIFT_REPLIES.failed };
  const { personId, budget } = parsed.data;

  if (!(await canHaveIdeas(supabase, userId, personId))) {
    return { kind: "message", tone: "info", text: GIFT_REPLIES.notForThisDay };
  }

  let raw: unknown;
  if (aiMock()) {
    raw = { kind: "ideas", ideas: MOCK_IDEAS, budget, createdAt: new Date().toISOString() };
  } else {
    const { data, error } = await supabase.functions.invoke("gift-ideas", {
      method: "POST",
      body: { personId, budget },
    });
    if (error) {
      let code = "failed";
      if (error instanceof FunctionsHttpError) {
        const body = (await error.context.json().catch(() => ({}))) as { error?: string };
        code = body.error ?? code;
      }
      if (code === "user_limit")
        return { kind: "message", tone: "info", text: GIFT_REPLIES.userLimit };
      if (code === "global_limit") {
        return { kind: "message", tone: "info", text: GIFT_REPLIES.globalLimit };
      }
      if (code === "not_for_this_day") {
        return { kind: "message", tone: "info", text: GIFT_REPLIES.notForThisDay };
      }
      return { kind: "message", tone: "error", text: GIFT_REPLIES.failed };
    }
    raw = data;
  }

  const result = giftFunctionResultSchema.safeParse(raw);
  if (!result.success) return { kind: "message", tone: "error", text: GIFT_REPLIES.failed };
  if (result.data.kind === "unavailable") {
    return { kind: "message", tone: "error", text: GIFT_REPLIES.unavailable };
  }
  return result.data;
}

export type AddIdeaResult = { ok: true; plan: PlanView } | { ok: false; message: string };
const OOPS = "That didn't save. Please try again.";

/**
 * "Add to their plan": opens the plan for that day (making it if new), then
 * renames its unticked Gift step to the idea, or adds an unticked one
 * (giftIdeaStep). It's an idea to act on, so it's never ticked.
 */
export async function addGiftIdeaToPlan(input: unknown): Promise<AddIdeaResult> {
  const { supabase } = await signedIn();
  const parsed = addIdeaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: OOPS };
  const { occasionId, occursOn, title } = parsed.data;

  // Yours (RLS), and never a gentle day.
  const { data: occasion } = await supabase
    .from("occasions")
    .select("kind, people (in_memory)")
    .eq("id", occasionId)
    .maybeSingle();
  const person = occasion?.people as { in_memory: boolean } | null | undefined;
  if (!occasion || occasion.kind === "remembrance" || person?.in_memory) {
    return { ok: false, message: OOPS };
  }

  const { data: planId, error } = await supabase.rpc("start_plan", {
    p_occasion_id: occasionId,
    p_occurs_on: occursOn,
  });
  if (error || !planId) return { ok: false, message: OOPS };
  const plan = await loadPlan(supabase, planId);
  if (!plan) return { ok: false, message: OOPS };

  const step = giftIdeaStep(plan.steps);
  const { error: saveError } =
    step.action === "rename"
      ? await supabase.from("plan_steps").update({ label: title }).eq("id", step.stepId)
      : await supabase.from("plan_steps").insert({
          plan_id: plan.id,
          kind: "gift",
          label: title,
          position: nextPosition(plan.steps),
        });
  if (saveError) {
    if (saveError.message.includes("too_many_steps")) {
      return { ok: false, message: "A plan holds 12 steps. Remove one to add another." };
    }
    return { ok: false, message: OOPS };
  }
  const updated = await loadPlan(supabase, plan.id);
  return updated ? { ok: true, plan: updated } : { ok: false, message: OOPS };
}
