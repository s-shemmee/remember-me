/**
 * gift-ideas: Noor's gift ideas for one of your people (src/ai/gift-ideas).
 * Called by the newGiftIdeas Server Action with the signed-in user's token,
 * or by `pnpm ai:eval` with AI_ADMIN_SECRET and a fictional person (no
 * database, no limits).
 *
 * Everything the prompt uses is loaded here, server side, from a whitelist:
 * the person must be yours, not "In memory", with a day coming that isn't
 * gentle. Wish titles come only from gift_idea_wishes() (shared, connected,
 * and free). The prompt and the answer are never logged; the only things
 * kept are the daily count and the last ideas for that person.
 */
import { z } from "zod";

import { generateGiftIdeas, type Provider } from "../../../src/ai/gift-ideas/ideas.ts";
import {
  BUDGETS,
  GIFT_KINDS,
  nextGiftDay,
  type OccasionForGifts,
  toPromptInput,
  type WishForPrompt,
} from "../../../src/ai/gift-ideas/prompt.ts";
import { todayIn } from "../../../src/lib/dates.ts";

import { aiAdminSecret, generate, intEnv } from "../_shared/ai.ts";
import { json, safeEqual } from "../_shared/env.ts";
import { adminClient } from "../_shared/reminders.ts";

const FEATURE = "gift_ideas";

const userBody = z.object({
  personId: z.uuid(),
  budget: z.enum(BUDGETS).nullable().default(null),
});

// Evals only: a fictional person, never a real one.
const evalBody = z.object({
  budget: z.enum(BUDGETS).nullable().default(null),
  person: z.object({
    name: z.string().min(1).max(80),
    relationKind: z.string().max(40).nullable(),
    occasion: z.enum(GIFT_KINDS),
    littleThings: z.array(z.string().max(80)).max(20),
    wishes: z.array(z.string().max(80)).max(10),
  }),
});

const deps = {
  generate: (messages: Parameters<typeof generate>[0], provider: Provider) =>
    generate(messages, { only: provider, temperature: 0.7, maxTokens: 600 }),
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json({ error: "unauthorized" }, 401);

  try {
    let isEval = false;
    try {
      isEval = safeEqual(token, aiAdminSecret());
    } catch {
      isEval = false; // no admin secret set: only users can ask
    }
    const body = await req.json().catch(() => null);

    if (isEval) {
      const parsed = evalBody.safeParse(body);
      if (!parsed.success) return json({ error: "invalid_body" }, 400);
      const { person, budget } = parsed.data;
      const input = toPromptInput({
        name: person.name,
        relationKind: person.relationKind,
        occasion: person.occasion,
        budget,
        littleThings: person.littleThings,
        wishes: person.wishes.map((title) => ({ title, status: "free" as const })),
      });
      return json(await generateGiftIdeas(input, deps));
    }

    const db = adminClient();
    const { data: auth, error: authError } = await db.auth.getUser(token);
    const user = auth?.user;
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    const parsed = userBody.safeParse(body);
    if (!parsed.success) return json({ error: "invalid_body" }, 400);
    const { personId, budget } = parsed.data;

    // Only the whitelisted columns are read.
    const { data: person, error: personError } = await db
      .from("people")
      .select(
        "name, relation_kind, little_things, in_memory, occasions (kind, day, month, year, recurring)",
      )
      .eq("id", personId)
      .eq("owner_id", user.id)
      .is("archived_at", null)
      .maybeSingle();
    if (personError) throw new Error(personError.message);
    if (!person) return json({ error: "not_found" }, 404);

    const { data: profile } = await db
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();
    const day = nextGiftDay(
      (person.occasions ?? []) as OccasionForGifts[],
      todayIn(profile?.timezone),
      Boolean(person.in_memory),
    );
    // "In memory", or only gentle days: no gift ideas (the UI hides them too).
    if (!day) return json({ error: "not_for_this_day" }, 409);

    const { data: wishes, error: wishError } = await db.rpc("gift_idea_wishes", {
      p_viewer: user.id,
      p_person_id: personId,
    });
    if (wishError) throw new Error(wishError.message);

    const claim = await db.rpc("claim_ai_use", {
      p_profile_id: user.id,
      p_feature: FEATURE,
      p_user_limit: intEnv("AI_GIFT_IDEAS_DAILY_LIMIT", 5),
      p_global_limit: intEnv("AI_GLOBAL_DAILY_CAP", 500),
    });
    if (claim.error) throw new Error(claim.error.message);
    if (claim.data !== "ok") return json({ error: claim.data }, 429);

    const input = toPromptInput({
      name: person.name as string,
      relationKind: person.relation_kind as string | null,
      occasion: day.kind,
      budget,
      littleThings: (person.little_things ?? []) as string[],
      wishes: (wishes ?? []) as WishForPrompt[],
    });
    const result = await generateGiftIdeas(input, deps);
    if (result.kind !== "ideas") return json(result);

    const createdAt = new Date().toISOString();
    const { error: saveError } = await db.from("gift_idea_results").upsert({
      person_id: personId,
      owner_id: user.id,
      occasion_kind: day.kind,
      budget,
      ideas: result.ideas,
      created_at: createdAt,
    });
    if (saveError) throw new Error(saveError.message);
    return json({ ...result, budget, createdAt });
  } catch (error) {
    // Never the prompt or the ideas: only what went wrong.
    console.error(
      "gift-ideas failed:",
      error instanceof Error ? error.message.slice(0, 120) : "unknown",
    );
    return json({ error: "failed" }, 500);
  }
});
