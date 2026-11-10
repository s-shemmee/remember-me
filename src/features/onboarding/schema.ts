import { z } from "zod";

import { pastels } from "@/styles/tokens";

import { CHARACTER_KEYS, NAME_MAX, RELATIONS, REMINDER_DAYS } from "./constants";

/**
 * Onboarding validation, mirroring complete_onboarding() in the database
 * (supabase/migrations/…_onboarding*.sql). Each step has its own schema so
 * Continue can explain what's missing; `onboardingSchema` checks it all
 * again on the server before the database call.
 */

export const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** A real day of the year; 29 February is allowed (it falls on the 28th otherwise). */
export function isRealDayMonth(day: number, month: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const max = month === 2 ? 29 : [4, 6, 9, 11].includes(month) ? 30 : 31;
  return day <= max;
}

const thisYear = () => new Date().getFullYear();

const optionalYear = z
  .number({ error: "Use a year like 1995." })
  .int({ error: "Use a year like 1995." })
  .min(1900, { error: "Use a year like 1995." })
  .refine((y) => y <= thisYear(), { error: "That year hasn't happened yet." })
  .nullable();

/** Shared birthday rules: day + month required together, real date, leap years. */
function birthdayRules(
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

const dayField = z.number().int().min(1).max(31).nullable();
const monthField = z.number().int().min(1).max(12).nullable();

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
      day: dayField,
      month: monthField,
      year: optionalYear,
      littleThing: z.string().trim().max(80, { error: "Keep it under 80 characters." }),
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
