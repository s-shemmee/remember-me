import { z } from "zod";

import { birthdayRules, dayField, monthField, optionalYear } from "@/features/onboarding/schema";
import { isLeapYear, isRealDayMonth } from "@/lib/dates";
import { occasionType, OTHER_DAY_KINDS, type OtherDayKind } from "@/features/occasions/types";
import { pastels } from "@/styles/tokens";

import {
  DAY_TITLE_MAX,
  DESCRIPTION_MAX,
  LITTLE_THING_MAX,
  LITTLE_THINGS_LIMIT,
  NAME_MAX,
  OTHER_DAYS_LIMIT,
  RELATIONS,
} from "./constants";

/**
 * The add / edit person form, mirroring save_person() in the database
 * (supabase/migrations/…_people_editing.sql). Checked in the dialog to
 * explain what's missing, then again in the Server Action.
 */

const otherDaySchema = z
  .object({
    /** Set when editing an existing day, so its id stays the same. */
    id: z.uuid().nullable(),
    kind: z.enum(OTHER_DAY_KINDS as [OtherDayKind, ...OtherDayKind[]]),
    /** Every year (true) or once, on day/month/year (false). */
    recurring: z.boolean(),
    /** The person changed the repeat themselves: chips no longer change it. */
    repeatChosen: z.boolean().optional(),
    title: z
      .string()
      .trim()
      .max(DAY_TITLE_MAX, { error: `Keep it to ${DAY_TITLE_MAX} characters.` }),
    day: dayField,
    month: monthField,
    year: z
      .number({ error: "Use a year like 2015." })
      .int({ error: "Use a year like 2015." })
      .min(1900, { error: "Use a year like 2015." })
      .max(2100, { error: "Use a year like 2015." })
      .nullable(),
  })
  .superRefine((v, ctx) => {
    if (occasionType(v.kind).titleRequired && !v.title) {
      ctx.addIssue({ code: "custom", path: ["title"], message: "What's the day called?" });
    }
    if (!v.recurring && v.year === null) {
      ctx.addIssue({
        code: "custom",
        path: ["year"],
        message: "Add the year, so I know when it happens.",
      });
    }
    if (v.day === null || v.month === null) {
      ctx.addIssue({
        code: "custom",
        path: [v.day === null ? "day" : "month"],
        message: "Pick a day and month.",
      });
      return;
    }
    if (!isRealDayMonth(v.day, v.month)) {
      ctx.addIssue({
        code: "custom",
        path: ["day"],
        message: "That day doesn't exist in that month.",
      });
      return;
    }
    if (v.year !== null && v.month === 2 && v.day === 29 && !isLeapYear(v.year)) {
      ctx.addIssue({ code: "custom", path: ["year"], message: `${v.year} had no 29 February.` });
    }
  });

export const personFormSchema = z
  .object({
    id: z.uuid().nullable(),
    name: z
      .string()
      .trim()
      .min(1, { error: "What's their name?" })
      .max(NAME_MAX, { error: `Keep it to ${NAME_MAX} characters.` }),
    relationKind: z.enum(RELATIONS),
    description: z
      .string()
      .trim()
      .max(DESCRIPTION_MAX, { error: `Keep it to ${DESCRIPTION_MAX} characters.` }),
    color: z.enum(pastels),
    day: dayField,
    month: monthField,
    year: optionalYear,
    littleThings: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(LITTLE_THING_MAX, { error: `Keep each one to ${LITTLE_THING_MAX} characters.` }),
      )
      .max(LITTLE_THINGS_LIMIT, { error: `Up to ${LITTLE_THINGS_LIMIT} little things.` }),
    days: z
      .array(otherDaySchema)
      .max(OTHER_DAYS_LIMIT, { error: `Up to ${OTHER_DAYS_LIMIT} other days.` }),
  })
  .superRefine((v, ctx) =>
    birthdayRules(v, ctx, { missing: "When is their birthday? Day and month." }),
  );

export type PersonFormValues = z.input<typeof personFormSchema>;
export type PersonFormData = z.output<typeof personFormSchema>;
export type OtherDayValues = PersonFormValues["days"][number];

/**
 * First message per field, keyed by its full path: "name", "day",
 * "days.0.title", "littleThings.3"…
 */
export function personFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}
