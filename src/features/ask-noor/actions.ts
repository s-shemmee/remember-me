"use server";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { questionSchema } from "@/ai/ask-noor/answer";
import { aiEnabled, aiMock } from "@/ai/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { askFunctionResultSchema, type AskNoorState, mockAnswer, NOOR_REPLIES } from "./schema";

/**
 * Ask Noor (Settings → Help & feedback): one question, one answer from our
 * own documents. Checks the user and the question here; the ask-noor Edge
 * Function checks the token again, takes a use from the daily limits, and
 * answers. The question is never stored, logged or sent to Sentry.
 */
export async function askNoor(_prev: AskNoorState, formData: FormData): Promise<AskNoorState> {
  if (!aiEnabled()) return { kind: "message", tone: "info", text: NOOR_REPLIES.disabled };

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/log-in?next=%2Fsettings%23ask-noor");

  const parsed = questionSchema.safeParse(formData.get("question"));
  if (!parsed.success) {
    return {
      kind: "message",
      tone: "error",
      text: parsed.error.issues[0]?.message ?? "Please try again.",
    };
  }
  const question = parsed.data;

  let raw: unknown;
  if (aiMock()) {
    raw = mockAnswer(question);
  } else {
    const { data, error } = await supabase.functions.invoke("ask-noor", {
      method: "POST",
      body: { question },
    });
    if (error) {
      let code = "failed";
      if (error instanceof FunctionsHttpError) {
        const body = (await error.context.json().catch(() => ({}))) as { error?: string };
        code = body.error ?? code;
      }
      const text =
        code === "user_limit"
          ? NOOR_REPLIES.userLimit
          : code === "global_limit"
            ? NOOR_REPLIES.globalLimit
            : code === "invalid_question"
              ? "Ask me a question about Remember Me, in up to 300 characters."
              : NOOR_REPLIES.failed;
      return { kind: "message", question, tone: code.endsWith("limit") ? "info" : "error", text };
    }
    raw = data;
  }

  const result = askFunctionResultSchema.safeParse(raw);
  if (!result.success)
    return { kind: "message", question, tone: "error", text: NOOR_REPLIES.failed };
  if (result.data.kind === "answer") {
    return { kind: "answer", question, answer: result.data.answer, sources: result.data.sources };
  }
  return {
    kind: "message",
    question,
    tone: "info",
    text: result.data.kind === "out_of_scope" ? NOOR_REPLIES.outOfScope : NOOR_REPLIES.unsure,
  };
}
