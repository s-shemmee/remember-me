"use server";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { aiMock, messagesEnabled } from "@/ai/config";
import { nextGiftDay, type OccasionForGifts } from "@/ai/gift-ideas/prompt";
import { loadPlan } from "@/features/plans/load";
import { nextPosition, type PlanView } from "@/features/plans/steps";
import { littleThingsOf } from "@/features/people/little-emoji";
import { addDays, todayIn } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  contextSchema,
  draftRequestSchema,
  type DraftsState,
  type MessageContext,
  functionResultSchema,
  MESSAGE_REPLIES,
  MOCK_MESSAGES,
  useInPlanSchema,
} from "./schema";

/**
 * Noor drafts a message (a person's page, and the Message step of a plan).
 * The Edge Function does the AI part and checks everything again; here we
 * check the user, the input, and that the day is yours (RLS), for someone
 * not "In memory", with a day coming that isn't gentle. Prompts and drafts
 * are never logged or stored; only "Use in plan" saves the text you chose.
 */

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/log-in?next=%2Fpeople");
  return { supabase, userId: userId as string };
}

type Supabase = Awaited<ReturnType<typeof signedIn>>["supabase"];

/** The person of that day, if it's yours (RLS) and they can have messages. */
async function personFor(supabase: Supabase, userId: string, occasionId: string) {
  const [{ data: occasion }, { data: profile }] = await Promise.all([
    supabase
      .from("occasions")
      .select("person_id, people (in_memory, occasions (kind, day, month, year, recurring))")
      .eq("id", occasionId)
      .maybeSingle(),
    supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
  ]);
  const person = occasion?.people as
    { in_memory: boolean; occasions: OccasionForGifts[] } | null | undefined;
  if (!occasion?.person_id || !person) return null;
  const day = nextGiftDay(person.occasions ?? [], todayIn(profile?.timezone), person.in_memory);
  return day ? occasion.person_id : null;
}

const info = (text: string): DraftsState => ({ kind: "message", tone: "info", text });
const oops = (text: string = MESSAGE_REPLIES.failed): DraftsState => ({
  kind: "message",
  tone: "error",
  text,
});

/**
 * What the sheet lets you choose from (no AI call): their little things, and
 * their age if this is their birthday and the year is known.
 */
export async function messageContext(input: unknown): Promise<MessageContext | null> {
  if (!messagesEnabled()) return null;
  const { supabase, userId } = await signedIn();
  const parsed = contextSchema.safeParse(input);
  if (!parsed.success) return null;
  const [{ data: occasion }, { data: profile }] = await Promise.all([
    supabase
      .from("occasions")
      .select(
        "people (in_memory, little_things, little_thing_emojis, occasions (kind, day, month, year, recurring))",
      )
      .eq("id", parsed.data.occasionId)
      .maybeSingle(),
    supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
  ]);
  const person = occasion?.people as
    | {
        in_memory: boolean;
        little_things: string[];
        little_thing_emojis: string[] | null;
        occasions: OccasionForGifts[];
      }
    | null
    | undefined;
  if (!person) return null;
  const today = todayIn(profile?.timezone);
  const day = nextGiftDay(person.occasions ?? [], today, person.in_memory);
  if (!day) return null;
  const birthday = person.occasions.find((o) => o.kind === "birthday");
  return {
    littleThings: littleThingsOf(person.little_things ?? [], person.little_thing_emojis),
    age:
      day.kind === "birthday" && birthday?.year
        ? addDays(today, day.daysUntil).year - birthday.year
        : null,
  };
}

/** "Write with Noor" / "New drafts": uses one of today's 10. */
export async function draftNoorMessages(input: unknown): Promise<DraftsState> {
  if (!messagesEnabled()) return info(MESSAGE_REPLIES.disabled);
  const { supabase, userId } = await signedIn();
  const parsed = draftRequestSchema.safeParse(input);
  if (!parsed.success) return oops();
  const { occasionId, tone, language, length, mention, includeAge, things } = parsed.data;

  const personId = await personFor(supabase, userId, occasionId);
  if (!personId) return info(MESSAGE_REPLIES.notForThisDay);

  let raw: unknown;
  if (aiMock()) {
    raw = { kind: "messages", messages: MOCK_MESSAGES[language] };
  } else {
    const { data, error } = await supabase.functions.invoke("noor-messages", {
      method: "POST",
      body: { personId, tone, language, length, mention, includeAge, things },
    });
    if (error) {
      let code = "failed";
      if (error instanceof FunctionsHttpError) {
        const body = (await error.context.json().catch(() => ({}))) as { error?: string };
        code = body.error ?? code;
      }
      if (code === "user_limit") return info(MESSAGE_REPLIES.userLimit);
      if (code === "global_limit") return info(MESSAGE_REPLIES.globalLimit);
      if (code === "not_for_this_day") return info(MESSAGE_REPLIES.notForThisDay);
      return oops();
    }
    raw = data;
  }

  const result = functionResultSchema.safeParse(raw);
  if (!result.success) return oops();
  if (result.data.kind === "refused") return info(MESSAGE_REPLIES.refused);
  if (result.data.kind === "unavailable") return oops(MESSAGE_REPLIES.unavailable);
  return result.data;
}

export type SaveInPlanResult = { ok: true; plan: PlanView } | { ok: false; message: string };
const OOPS = "That didn't save. Please try again.";

/**
 * "Use in plan": the text you chose (and maybe edited) goes on the plan's
 * Message step, which is ticked. Opens the plan for that day if it's new,
 * and adds a Message step if it has none left unticked.
 */
export async function saveMessageInPlan(input: unknown): Promise<SaveInPlanResult> {
  const { supabase, userId } = await signedIn();
  const parsed = useInPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? OOPS };
  const { occasionId, occursOn, stepId, text } = parsed.data;
  if (!(await personFor(supabase, userId, occasionId))) return { ok: false, message: OOPS };

  const { data: planId, error } = await supabase.rpc("start_plan", {
    p_occasion_id: occasionId,
    p_occurs_on: occursOn,
  });
  if (error || !planId) return { ok: false, message: OOPS };
  const plan = await loadPlan(supabase, planId);
  if (!plan) return { ok: false, message: OOPS };

  let target = stepId ? plan.steps.find((s) => s.id === stepId) : undefined;
  if (stepId && !target) return { ok: false, message: OOPS };
  target ??= plan.steps.find((s) => s.kind === "message" && !s.done);
  let id = target?.id;
  if (!id) {
    const { data: added, error: addError } = await supabase
      .from("plan_steps")
      .insert({
        plan_id: plan.id,
        kind: "message",
        label: "Message",
        position: nextPosition(plan.steps),
      })
      .select("id")
      .single();
    if (addError || !added) {
      return {
        ok: false,
        message: addError?.message.includes("too_many_steps")
          ? "A plan holds 12 steps. Remove one to add another."
          : OOPS,
      };
    }
    id = added.id;
  }
  const { error: saveError } = await supabase
    .from("plan_steps")
    .update({ message: text, done_at: new Date().toISOString(), ticked_by: "me" })
    .eq("id", id);
  if (saveError) return { ok: false, message: OOPS };
  const updated = await loadPlan(supabase, plan.id);
  return updated ? { ok: true, plan: updated } : { ok: false, message: OOPS };
}
