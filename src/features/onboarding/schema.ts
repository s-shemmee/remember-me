import { z } from "zod";

import { isLeapYear, isRealDayMonth } from "@/lib/dates";
import { pastels } from "@/styles/tokens";

import { LITTLE_THING_MAX } from "@/features/people/constants";

import { CHARACTER_KEYS, DESCRIPTION_MAX, NAME_MAX, RELATIONS, REMINDER_DAYS } from "./constants";

/**
 * Onboarding validation, mirroring complete_onboarding() in the database
 * (supabase/migrations/…_onboarding*.sql). Each step has its own schema so
 * Continue can explain what's missing; `onboardingSchema` checks it all
 * again on the server before the database call.
 */

export { isLeapYear, isRealDayMonth };

const thisYear = () => new Date().getFullYear();

export const optionalYear = z
  .number({ error: "Use a year like 1995." })
  .int({ error: "Use a year like 1995." })
  .min(1900, { error: "Use a year like 1995." })
  .refine((y) => y <= thisYear(), { error: "That year hasn't happened yet." })
  .nullable();

/** Shared birthday rules: day + month required together, real date, leap years. */
export function birthdayRules(
  value: { day: number | null; month: number | null; year: number | null },
  ctx: z.RefinementCtx,
  messages: { missing: string },
) {
  const { day, month, year } = value;
  if (day === null || month === null) {
    ctx.addIssue({
      code: "custom",
      path: [day === null ? "day" : "month"],
      message: messages.missing,
    });
    return;
  }
  if (!isRealDayMonth(day, month)) {
    ctx.addIssue({
      code: "custom",
      path: ["day"],
      message: "That day doesn't exist in that month.",
    });
    return;
  }
  if (year !== null && month === 2 && day === 29 && !isLeapYear(year)) {
    ctx.addIssue({ code: "custom", path: ["year"], message: `${year} had no 29 February.` });
  }
}

export const dayField = z.number().int().min(1).max(31).nullable();
export const monthField = z.number().int().min(1).max(12).nullable();

export const youSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, { error: "What should we call you?" })
      .max(NAME_MAX, { error: `Keep it to ${NAME_MAX} characters.` }),
    day: dayField,
    month: monthField,
    year: optionalYear,
  })
  .superRefine((v, ctx) =>
    birthdayRules(v, ctx, { missing: "Pick your birthday: day and month." }),
  );

export const lookSchema = z
  .object({
    kind: z.enum(["initials", "character"]),
    color: z.enum(pastels),
    character: z.enum(CHARACTER_KEYS).nullable(),
  })
  .refine((v) => v.kind !== "character" || v.character !== null, {
    path: ["character"],
    error: "Pick a character, or choose initials.",
  });

export const personSchema = z.discriminatedUnion("skipped", [
  z.object({ skipped: z.literal(true) }),
  z
    .object({
      skipped: z.literal(false),
      name: z
        .string()
        .trim()
        .min(1, { error: "What's their name?" })
        .max(NAME_MAX, { error: `Keep it to ${NAME_MAX} characters.` }),
      relation: z.enum(RELATIONS),
      description: z
        .string()
        .trim()
        .max(DESCRIPTION_MAX, { error: `Keep it to ${DESCRIPTION_MAX} characters.` })
        .default(""),
      day: dayField,
      month: monthField,
      year: optionalYear,
      littleThing: z
        .string()
        .trim()
        .max(LITTLE_THING_MAX, { error: `Keep it to ${LITTLE_THING_MAX} characters.` }),
    })
    .superRefine((v, ctx) =>
      birthdayRules(v, ctx, { missing: "When is their birthday? Day and month." }),
    ),
]);

export const remindersSchema = z.object({
  offsets: z
    .array(z.number().refine((d) => REMINDER_DAYS.includes(d as (typeof REMINDER_DAYS)[number])))
    .min(1, { error: "Pick at least one, so I know when to nudge you." })
    .max(REMINDER_DAYS.length),
  email: z.boolean(),
  push: z.boolean(),
});

export const onboardingSchema = z.object({
  you: youSchema,
  look: lookSchema,
  person: personSchema,
  reminders: remindersSchema,
  timezone: z.string().max(64).nullable(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type YouInput = z.input<typeof youSchema>;
export type LookInput = z.input<typeof lookSchema>;
export type PersonInput = z.input<typeof personSchema>;
export type RemindersInput = z.input<typeof remindersSchema>;

export const stepSchemas = [youSchema, lookSchema, personSchema, remindersSchema] as const;

/** First message per field, keyed by the field name (day, month, name…). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path.at(-1) ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
