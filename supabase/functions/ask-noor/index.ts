/**
 * ask-noor: answers a question about Remember Me from our own documents
 * (src/ai/ask-noor/answer.ts). Called by the askNoor Server Action with the
 * signed-in user's token, or by `pnpm ai:eval` with AI_ADMIN_SECRET (no limits).
 *
 * The question is never stored or logged: the only thing kept is a daily
 * count per user (ai_usage_daily) for the limits.
 */
import {
  answerQuestion,
  DEFAULT_THRESHOLD,
  type RetrievedChunk,
} from "../../../src/ai/ask-noor/answer.ts";

import { aiAdminSecret, embed, generate, intEnv } from "../_shared/ai.ts";
import { json, safeEqual } from "../_shared/env.ts";
import { adminClient } from "../_shared/reminders.ts";

const FEATURE = "ask_noor";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json({ error: "unauthorized" }, 401);

  try {
    const db = adminClient();
    let isEval = false;
    try {
      isEval = safeEqual(token, aiAdminSecret());
    } catch {
      isEval = false; // no admin secret set: only users can ask
    }

    if (!isEval) {
      const { data, error } = await db.auth.getUser(token);
      const user = data?.user;
      if (error || !user) return json({ error: "unauthorized" }, 401);
      const claim = await db.rpc("claim_ai_use", {
        p_profile_id: user.id,
        p_feature: FEATURE,
        p_user_limit: intEnv("AI_USER_DAILY_LIMIT", 20),
        p_global_limit: intEnv("AI_GLOBAL_DAILY_CAP", 500),
      });
      if (claim.error) throw new Error(claim.error.message);
      if (claim.data !== "ok") return json({ error: claim.data }, 429);
    }

    const body = (await req.json().catch(() => ({}))) as { question?: unknown };
    if (typeof body.question !== "string") return json({ error: "invalid_question" }, 400);

    const threshold = Number(Deno.env.get("ASK_NOOR_THRESHOLD")) || DEFAULT_THRESHOLD;
    const result = await answerQuestion(
      body.question,
      {
        embed,
        match: async (embedding, t, count) => {
          const { data, error } = await db.rpc("match_help_chunks", {
            p_embedding: JSON.stringify(embedding),
            p_threshold: t,
            p_count: count,
          });
          if (error) throw new Error(error.message);
          return (data ?? []) as RetrievedChunk[];
        },
        generate,
      },
      { threshold },
    );
    return json(result);
  } catch (error) {
    // Never the question: only what went wrong.
    const message = error instanceof Error ? error.name : "unknown";
    if (message === "ZodError") return json({ error: "invalid_question" }, 400);
    console.error(
      "ask-noor failed:",
      error instanceof Error ? error.message.slice(0, 120) : "unknown",
    );
    return json({ error: "failed" }, 500);
  }
});
