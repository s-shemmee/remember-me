/**
 * noor-messages: Noor drafts 3 messages to one of your people
 * (src/ai/messages). Called by the draftMessages Server Action with the
 * signed-in user's token, or by `pnpm ai:eval messages` with AI_ADMIN_SECRET
 * and a fictional person (no database, no limits).
 *
 * Everything the prompt uses is loaded here, server side, from a whitelist:
 * the person must be yours, not "In memory", with a day coming that isn't
 * gentle; only the little things the user chose; the age only when they
 * allow it, for a birthday with a known year. Each call (a
 * regenerate too) takes one of today's uses (`messages`, 10 by default).
 * The prompt and the drafts are never logged or stored: only the daily
 * count is kept.
 */
import { z } from "zod";

import { nextGiftDay, type OccasionForGifts } from "../../../src/ai/gift-ideas/prompt.ts";
import { draftMessages, type Provider } from "../../../src/ai/messages/drafts.ts";
import {
  LANGUAGES,
  LENGTHS,
  MENTION_MAX,
  MESSAGE_KINDS,
  type MessagePrompt,
  toMessageInput,
  TONES,
} from "../../../src/ai/messages/prompt.ts";
import { addDays, todayIn } from "../../../src/lib/dates.ts";

import { aiAdminSecret, generate, intEnv } from "../_shared/ai.ts";
import { json, safeEqual } from "../_shared/env.ts";
import { adminClient } from "../_shared/reminders.ts";

const FEATURE = "messages";

const choices = {
  tone: z.enum(TONES),
  language: z.enum(LANGUAGES),
  length: z.enum(LENGTHS),
  mention: z.string().max(MENTION_MAX).nullable().default(null),
};

const userBody = z.object({
  personId: z.uuid(),
  ...choices,
  /** Their age, only when the user allows it (and it's known). */
  includeAge: z.boolean().default(false),
  /** The little things the user chose (null: all); only ones they really have are used. */
  things: z.array(z.string().max(80)).max(20).nullable().default(null),
});

// Evals only: a fictional person, never a real one.
const evalBody = z.object({
  ...choices,
  person: z.object({
    name: z.string().min(1).max(80),
    relationKind: z.string().max(40).nullable(),
    occasion: z.enum(MESSAGE_KINDS),
    age: z.number().int().min(1).max(129).nullable(),
    littleThings: z.array(z.string().max(80)).max(20),
  }),
});

const deps = {
  generate: (messages: MessagePrompt, provider: Provider) =>
    generate(messages, { only: provider, temperature: 0.8, maxTokens: 700 }),
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
      const { person, ...c } = parsed.data;
      const input = toMessageInput({ name: person.name, ...person, ...c });
      return json(await draftMessages(input, deps));
    }

    const db = adminClient();
    const { data: auth, error: authError } = await db.auth.getUser(token);
    const user = auth?.user;
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    const parsed = userBody.safeParse(body);
    if (!parsed.success) return json({ error: "invalid_body" }, 400);
    const { personId, tone, language, length, mention, includeAge, things } = parsed.data;

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
    const today = todayIn(profile?.timezone);
    const occasions = (person.occasions ?? []) as OccasionForGifts[];
    const day = nextGiftDay(occasions, today, Boolean(person.in_memory));
    // "In memory", or only gentle days: no drafted messages (the UI hides them too).
    if (!day) return json({ error: "not_for_this_day" }, 409);

    // Their age only when the user allows it, on their birthday, with a known birth year.
    const birthday = occasions.find((o) => o.kind === "birthday");
    const age =
      includeAge && day.kind === "birthday" && birthday?.year
        ? addDays(today, day.daysUntil).year - birthday.year
        : null;
    const stored = (person.little_things ?? []) as string[];
    const chosen = things === null ? stored : stored.filter((t) => things.includes(t));

    const claim = await db.rpc("claim_ai_use", {
      p_profile_id: user.id,
      p_feature: FEATURE,
      p_user_limit: intEnv("AI_MESSAGES_DAILY_LIMIT", 10),
      p_global_limit: intEnv("AI_GLOBAL_DAILY_CAP", 500),
    });
    if (claim.error) throw new Error(claim.error.message);
    if (claim.data !== "ok") return json({ error: claim.data }, 429);

    const input = toMessageInput({
      name: person.name as string,
      relationKind: person.relation_kind as string | null,
      occasion: day.kind,
      age,
      littleThings: chosen,
      mention,
      tone,
      language,
      length,
    });
    return json(await draftMessages(input, deps));
  } catch (error) {
    // Never the prompt or the drafts: only what went wrong.
    console.error(
      "noor-messages failed:",
      error instanceof Error ? error.message.slice(0, 120) : "unknown",
    );
    return json({ error: "failed" }, 500);
  }
});
