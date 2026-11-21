import { z } from "zod";

import { draftsSchema } from "@/ai/messages/drafts";
import {
  LANGUAGES,
  type Language,
  LENGTHS,
  type Length,
  MENTION_MAX,
  MESSAGE_MAX,
  TONES,
  type Tone,
} from "@/ai/messages/prompt";

/**
 * Noor drafts a message: what the Server Actions take and return. The Edge
 * Function's reply is validated again here (the app never trusts it blindly).
 */
export const draftRequestSchema = z.object({
  /** The day it's for (yours, RLS); the person comes from it. */
  occasionId: z.uuid(),
  tone: z.enum(TONES),
  language: z.enum(LANGUAGES),
  length: z.enum(LENGTHS),
  mention: z
    .string()
    .trim()
    .max(MENTION_MAX)
    .nullable()
    .default(null)
    .transform((s) => s || null),
  /** Mention their age (only sent when known): off unless the user turns it on. */
  includeAge: z.boolean().default(false),
  /** The little things to use (their text); null: all of them. */
  things: z.array(z.string().max(80)).max(20).nullable().default(null),
});
export type DraftRequest = z.input<typeof draftRequestSchema>;

export const contextSchema = z.object({ occasionId: z.uuid() });

export const useInPlanSchema = z.object({
  occasionId: z.uuid(),
  occursOn: z.iso.date(),
  /** The step it goes on (from the plan); without, the plan's Message step. */
  stepId: z.uuid().nullable().default(null),
  text: z.string().trim().min(1, { error: "Write something first." }).max(MESSAGE_MAX),
});

export const functionResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("messages"), messages: draftsSchema }),
  z.object({ kind: z.literal("refused") }),
  z.object({ kind: z.literal("unavailable") }),
]);

/** What the sheet shows to choose from: their little things, and their age if known. */
export type MessageContext = {
  littleThings: { emoji: string; text: string }[];
  /** The age they turn on this birthday, when the year is known; else null. */
  age: number | null;
};

export type DraftsState =
  | { kind: "messages"; messages: string[] }
  | { kind: "message"; tone: "info" | "error"; text: string };

export const TONE_LABELS: Record<Tone, string> = {
  warm: "Warm",
  funny: "Funny",
  short_sweet: "Short and sweet",
  formal: "Formal",
};
export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  fr: "French",
  ar: "Arabic",
  darija: "Darija (Latin letters)",
};
export const LENGTH_LABELS: Record<Length, string> = { short: "Short", medium: "Medium" };

/** Noor's fixed replies (no AI involved). */
export const MESSAGE_REPLIES = {
  userLimit: "That's all my drafts for today. Ask me again tomorrow 🕯️",
  globalLimit: "I'm resting for today. Please try again tomorrow.",
  unavailable: "I couldn't find the words just now. Please try again in a moment.",
  refused: "I can only help with kind messages for your people.",
  failed: "Something went wrong on my side. Please try again in a moment.",
  notForThisDay: "I write messages for celebrations.",
  disabled: "Message drafts aren't available right now.",
} as const;

/** AI_MOCK=1 (e2e): fixed drafts per language, no AI call. */
export const MOCK_MESSAGES: Record<Language, string[]> = {
  en: [
    "Happy birthday! Wishing you a year as warm as your first coffee of the day ☕",
    "Another year of you, and we're all lucky for it. Have the best day!",
    "Happy birthday! Here's to football wins, good coffee and you ⚽",
  ],
  fr: [
    "Joyeux anniversaire ! Que cette année soit aussi douce que ton premier café ☕",
    "Encore une année avec toi, quelle chance. Passe une très belle journée !",
    "Bon anniversaire ! À tes victoires, au bon café, et à toi ⚽",
  ],
  ar: [
    "عيد ميلاد سعيد! أتمنى لك عاماً مليئاً بالفرح ☕",
    "كل عام وأنت بخير، يومك جميل كقلبك.",
    "عيد ميلاد سعيد! إلى المزيد من الضحك واللحظات الحلوة ⚽",
  ],
  darija: [
    "3id milad sa3id! Lah ykhllik lina w ykmmel 3lik bl khir ☕",
    "Sana zwina w kolha farha, nhar zwin bhalk!",
    "3id milad sa3id! Bzaf dyal l9hwa w l football had l3am ⚽",
  ],
};
