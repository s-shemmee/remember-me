import { z } from "zod";

import { ideasSchema } from "@/ai/gift-ideas/ideas";
import { BUDGETS } from "@/ai/gift-ideas/prompt";

/**
 * Noor's gift ideas: what the Server Actions take and return. The Edge
 * Function's reply is validated again here (the app never trusts it blindly).
 */
export const giftIdeasRequestSchema = z.object({
  personId: z.uuid(),
  budget: z.enum(BUDGETS).nullable().default(null),
});

export const addIdeaSchema = z.object({
  occasionId: z.uuid(),
  occursOn: z.iso.date(),
  title: z.string().trim().min(2).max(60),
});

export const giftFunctionResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ideas"),
    ideas: ideasSchema,
    budget: z.enum(BUDGETS).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
  }),
  z.object({ kind: z.literal("unavailable") }),
]);

export type GiftIdeaView = { title: string; why: string };
export type BudgetChoice = (typeof BUDGETS)[number];

export type GiftIdeasState =
  | { kind: "ideas"; ideas: GiftIdeaView[]; budget: BudgetChoice | null; createdAt: string }
  | { kind: "message"; tone: "info" | "error"; text: string };

export const BUDGET_LABELS: Record<BudgetChoice, string> = {
  small: "Small",
  medium: "Medium",
  treat: "Treat",
};

/** Noor's fixed replies (no AI involved). */
export const GIFT_REPLIES = {
  userLimit: "That's all my gift ideas for today. Ask me again tomorrow 🕯️",
  globalLimit: "I'm resting for today. Please try again tomorrow.",
  unavailable: "I couldn't think of good ideas just now. Please try again in a moment.",
  failed: "Something went wrong on my side. Please try again in a moment.",
  notForThisDay: "Gift ideas are only for celebrations.",
  disabled: "Gift ideas aren't available right now.",
} as const;

/** AI_MOCK=1 (e2e): fixed ideas, no AI call. */
export const MOCK_IDEAS: GiftIdeaView[] = [
  {
    title: "A cosy tea tasting set",
    why: "They love trying new teas, so a few to taste together feels just right.",
  },
  {
    title: "A day out hiking",
    why: "Plan a walk somewhere green, since being outdoors is their favourite thing.",
  },
  {
    title: "A handwritten book of memories",
    why: "Little notes about your best moments together, to keep and reread.",
  },
];
