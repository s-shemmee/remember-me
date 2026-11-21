"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { FEEDBACK_REPLIES, type FeedbackResult, feedbackSchema } from "./schema";

/**
 * Help & feedback → Send. Checks you're signed in and the message with Zod,
 * saves it with your own session (RLS: insert your own; a trigger allows 5
 * in 24 hours), then asks the send-feedback Edge Function to email it to us.
 * If that email fails, the message is still saved (and the function picks
 * it up on your next send).
 */
export async function sendFeedback(input: unknown): Promise<FeedbackResult> {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/log-in?next=%2Fhelp");

  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return {
      ok: false,
      message: issue?.message ?? FEEDBACK_REPLIES.failed,
      field: field === "type" || field === "message" ? field : undefined,
    };
  }
  const { type, message, meta } = parsed.data;

  const { error } = await supabase.from("feedback").insert({ type, message, meta: meta ?? {} });
  if (error) {
    if (error.message.includes("feedback_limit"))
      return { ok: false, message: FEEDBACK_REPLIES.limit };
    return { ok: false, message: FEEDBACK_REPLIES.failed };
  }

  const { error: emailError } = await supabase.functions.invoke("send-feedback", {
    method: "POST",
    body: {},
  });
  // Never the message: only that the email step didn't run.
  if (emailError) console.error("send-feedback:", emailError.name);
  return { ok: true };
}
