import { z } from "zod";

import { MAX_LABEL, MAX_NOTE } from "./steps";

const STEP_KINDS = [
  "gift",
  "message",
  "call",
  "cake",
  "kind_word",
  "visit",
  "friends",
  "treat",
  "other",
] as const;

export const stepKindSchema = z.enum(STEP_KINDS);

export const startPlanSchema = z.object({
  /** Null: your own birthday. */
  occasionId: z.uuid().nullable(),
  occursOn: z.iso.date(),
  /** Tick this suggested step straight away (a tap on the Home card before a plan exists). */
  tick: stepKindSchema.optional(),
});

export const stepLabelSchema = z
  .string()
  .trim()
  .min(1, { error: "Give the step a name." })
  .max(MAX_LABEL, { error: `Keep it under ${MAX_LABEL} characters.` });

export const addStepSchema = z.object({
  planId: z.uuid(),
  kind: stepKindSchema.default("other"),
  label: stepLabelSchema,
});

export const renameStepSchema = z.object({ stepId: z.uuid(), label: stepLabelSchema });

export const tickStepSchema = z.object({ stepId: z.uuid(), done: z.boolean() });

export const noteSchema = z.object({
  planId: z.uuid(),
  note: z
    .string()
    .trim()
    .max(MAX_NOTE, { error: `Keep it under ${MAX_NOTE} characters.` }),
});
