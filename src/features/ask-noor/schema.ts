import { z } from "zod";

/**
 * What the ask-noor Edge Function returns (validated again here: the Next app
 * never trusts a response blindly), and what the Ask Noor card shows.
 */
const sourceSchema = z.object({
  title: z.string().min(1).max(120),
  heading: z.string().min(1).max(300),
  url: z.string().regex(/^\/[A-Za-z0-9/_#-]*$/),
});

export const askFunctionResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("answer"),
    answer: z.string().min(1).max(900),
    sources: z.array(sourceSchema).min(1).max(3),
  }),
  z.object({ kind: z.literal("out_of_scope") }),
  z.object({ kind: z.literal("unsure") }),
]);

export type AskSource = z.infer<typeof sourceSchema>;

export type AskNoorState =
  | { kind: "idle" }
  | { kind: "answer"; question: string; answer: string; sources: AskSource[] }
  | { kind: "message"; question?: string; tone: "info" | "error"; text: string };

export const SUGGESTIONS = [
  "When do reminders arrive?",
  "Can my friend see who reserved their gift?",
  "How do I download my data?",
] as const;

/** Noor's fixed replies (no AI involved). */
export const NOOR_REPLIES = {
  outOfScope:
    "I can only help with Remember Me 🕯️ For anything else, write to contact@shemme.codes.",
  unsure:
    "I'm not sure about that one. The help center might have it, or write to contact@shemme.codes 🕯️",
  userLimit: "That's all my answers for today. Ask me again tomorrow 🕯️",
  globalLimit:
    "I'm resting for today. Please try again tomorrow, or have a look at the help center.",
  failed: "Something went wrong on my side. Please try again in a moment.",
  disabled: "Ask Noor isn't available right now.",
} as const;

/** AI_MOCK=1 (e2e): a fixed, sourced answer, or a refusal for obvious off-topic. */
export function mockAnswer(question: string): z.infer<typeof askFunctionResultSchema> {
  if (/capital|poem|weather|recipe/i.test(question)) return { kind: "out_of_scope" };
  return {
    kind: "answer",
    answer: "Reminders arrive at 9:00 in the morning, in your time zone 🕯️",
    sources: [
      {
        title: "Reminders by email and push",
        heading: "Choose when",
        url: "/help/reminders#choose-when",
      },
    ],
  };
}
