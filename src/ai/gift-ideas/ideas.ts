/**
 * Noor's gift ideas: checking the model's reply, and the retry and fallback.
 *
 *   input ─▶ prompt ─▶ Groq ─▶ Zod (3–5 ideas, length limits, no prices or links)
 *                       │ invalid or failed: Groq once more
 *                       │ still not: Cloudflare Workers AI
 *                       ▼ still not: "unavailable" (Noor says so kindly)
 *
 * Pure: the model is passed in, so Vitest tests every path. Shared with Deno.
 */
import { z } from "zod";

import { buildGiftMessages, type GiftMessages, type GiftPromptInput } from "./prompt.ts";

export const TITLE_MAX = 60;
export const WHY_MAX = 140;

/** Prices, amounts and currencies ("$20", "20 euros", "150 MAD", "£"). */
const PRICE =
  /[$€£¥]|\b\d+(?:[.,]\d+)?\s*(?:dh|dhs|mad|eur|euros?|usd|dollars?|gbp|pounds?|dirhams?)\b|\b(?:mad|eur|usd|gbp)\s*\d/i;
/** Links, domains and emails. */
const LINK = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|co|ma|fr|uk|shop|store)\b|@\w/i;

export const hasPriceOrLink = (s: string) => PRICE.test(s) || LINK.test(s);

const tidy = (s: string) =>
  s
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

export const ideaSchema = z.object({
  title: z
    .string()
    .transform(tidy)
    .pipe(z.string().min(2).max(TITLE_MAX))
    .refine((s) => !hasPriceOrLink(s), "no prices or links"),
  why: z
    .string()
    .transform(tidy)
    .pipe(z.string().min(2).max(WHY_MAX))
    .refine((s) => !hasPriceOrLink(s), "no prices or links"),
});
export type GiftIdea = z.infer<typeof ideaSchema>;

export const ideasSchema = z.array(ideaSchema).min(3).max(5);
export const modelOutputSchema = z.object({ ideas: ideasSchema });

/** The ideas in the reply, or null when it isn't usable as a whole. */
export function validateIdeas(raw: string): GiftIdea[] | null {
  let data: unknown;
  try {
    data = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
  const parsed = modelOutputSchema.safeParse(data);
  if (!parsed.success) return null;
  const seen = new Set<string>();
  const ideas = parsed.data.ideas.filter((i) => {
    const key = i.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return ideas.length >= 3 ? ideas : null;
}

export type Provider = "groq" | "cloudflare";
/** Each attempt, in order: the first model twice, then the fallback. */
export const ATTEMPTS: Provider[] = ["groq", "groq", "cloudflare"];

export type GiftDeps = {
  /** One provider's raw reply; throws when it fails or isn't configured. */
  generate: (messages: GiftMessages, provider: Provider) => Promise<string>;
};

export type GiftResult = { kind: "ideas"; ideas: GiftIdea[] } | { kind: "unavailable" };

export async function generateGiftIdeas(
  input: GiftPromptInput,
  deps: GiftDeps,
): Promise<GiftResult> {
  const messages = buildGiftMessages(input);
  for (const provider of ATTEMPTS) {
    let raw: string;
    try {
      raw = await deps.generate(messages, provider);
    } catch {
      continue;
    }
    const ideas = validateIdeas(raw);
    if (ideas) return { kind: "ideas", ideas };
  }
  return { kind: "unavailable" };
}

/** For evals: does an idea mention one of their little things (a shared word)? */
export function mentionsALittleThing(ideas: GiftIdea[], littleThings: string[]): boolean {
  const words = (s: string) =>
    s
      .toLowerCase()
      .split(/[^a-z0-9à-ÿ]+/)
      .filter((w) => w.length > 2);
  const thingWords = new Set(littleThings.flatMap(words));
  return ideas.some((i) => words(`${i.title} ${i.why}`).some((w) => thingWords.has(w)));
}
