/**
 * Noor drafts a message: checking the model's reply, and the retry and
 * fallback (the same chain as gift ideas).
 *
 *   input ─▶ prompt ─▶ Groq ─▶ Zod (3 messages, ≤ 400, no contact details or links)
 *                       │ invalid or failed: Groq once more
 *                       │ still not: Cloudflare Workers AI
 *                       ▼ still not: "unavailable" (Noor says so kindly)
 *   {"refused": true} (an off-topic or unkind "something to mention") ends it: "refused".
 *
 * Pure: the model is passed in, so Vitest tests every path. Shared with Deno.
 */
import { z } from "zod";

import { ATTEMPTS, type Provider } from "../gift-ideas/ideas.ts";
import {
  buildMessagePrompt,
  MESSAGE_MAX,
  type MessagePrompt,
  type MessagePromptInput,
} from "./prompt.ts";

export { ATTEMPTS, type Provider };

/** Emails, links, phone numbers: never in a drafted message. */
const CONTACT =
  /https?:\/\/|www\.|[\w.+-]+@[\w-]+\.[\w.]+|\b[a-z0-9-]+\.(?:com|net|org|io|co|ma|fr|uk)\b|(?:\+?\d[\d\s().-]{7,}\d)/i;
export const hasContactDetails = (s: string) => CONTACT.test(s);

const tidy = (s: string) =>
  s
    .replace(/\s*—\s*/g, ", ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const draftSchema = z
  .string()
  .transform(tidy)
  .pipe(z.string().min(2).max(MESSAGE_MAX))
  .refine((s) => !hasContactDetails(s), "no contact details or links");

export const draftsSchema = z.array(draftSchema).length(3);
const outputSchema = z.union([
  z.object({ messages: z.array(z.string()) }),
  z.object({ refused: z.literal(true) }),
]);

export type DraftCheck = { kind: "messages"; messages: string[] } | { kind: "refused" } | null;

/** The three drafts, a refusal, or null when the reply isn't usable as a whole. */
export function validateDrafts(raw: string): DraftCheck {
  let data: unknown;
  try {
    data = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
  const parsed = outputSchema.safeParse(data);
  if (!parsed.success) return null;
  if ("refused" in parsed.data) return { kind: "refused" };
  const drafts = draftsSchema.safeParse(parsed.data.messages);
  if (!drafts.success) return null;
  // Three different ones.
  if (new Set(drafts.data.map((m) => m.toLowerCase())).size < 3) return null;
  return { kind: "messages", messages: drafts.data };
}

export type DraftDeps = {
  /** One provider's raw reply; throws when it fails or isn't configured. */
  generate: (messages: MessagePrompt, provider: Provider) => Promise<string>;
};

export type DraftResult =
  { kind: "messages"; messages: string[] } | { kind: "refused" } | { kind: "unavailable" };

export async function draftMessages(
  input: MessagePromptInput,
  deps: DraftDeps,
): Promise<DraftResult> {
  const prompt = buildMessagePrompt(input);
  for (const provider of ATTEMPTS) {
    let raw: string;
    try {
      raw = await deps.generate(prompt, provider);
    } catch {
      continue;
    }
    const checked = validateDrafts(raw);
    if (checked) return checked;
  }
  return { kind: "unavailable" };
}

/** For evals: Arabic script in the text? (Darija must be in Latin letters.) */
export const hasArabicScript = (s: string) => /[؀-ۿ]/.test(s);
