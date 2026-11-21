import { z } from "zod";

import { CHARACTER_KEYS, PASTELS } from "@/features/onboarding/constants";
import { isLeapYear, isRealDayMonth } from "@/lib/dates";

import { CITY_MAX, FIRST_NAME_MAX, LAST_NAME_MAX, LITTLE_LINE_MAX } from "./constants";

export const themeSchema = z.enum(["light", "dark", "system"]);

/** A time zone this runtime knows ("Africa/Casablanca", "Europe/London"…). */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64 || !/^[A-Za-z_+\-/0-9]+$/.test(value)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** How your people see you: initials, a character or a photo, and a colour. */
export const lookSchema = z
  .object({
    kind: z.enum(["initials", "character", "photo"]),
    color: z.enum(PASTELS),
    character: z.enum(CHARACTER_KEYS).nullable(),
    photoPath: z.string().max(200).nullable(),
  })
  .superRefine((look, ctx) => {
    if (look.kind === "photo" && !look.photoPath) {
      ctx.addIssue({
        code: "custom",
        path: ["look"],
        message: "Add a photo, or pick initials or a character.",
      });
    }
    if (look.kind === "character" && !look.character) {
      ctx.addIssue({ code: "custom", path: ["look"], message: "Pick a character." });
    }
  });

/** Empty text is "not set" (null in the database). */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { error: message })
    .transform((v) => (v === "" ? null : v));

/**
 * Profile → About you: first and last name, birthday (year optional and
 * private), city, the little line about you, and time zone.
 */
export const aboutSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, { error: "Your first name, please." })
      .max(FIRST_NAME_MAX, { error: `Up to ${FIRST_NAME_MAX} characters.` }),
    lastName: optionalText(LAST_NAME_MAX, `Up to ${LAST_NAME_MAX} characters.`),
    birthday: z.object({
      day: z.number().int().min(1).max(31),
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(1900).max(new Date().getFullYear()).nullable(),
    }),
    city: optionalText(CITY_MAX, `Up to ${CITY_MAX} characters.`),
    bio: optionalText(LITTLE_LINE_MAX, `Up to ${LITTLE_LINE_MAX} characters.`),
    timezone: z.string().refine(isTimeZone, { error: "Pick a time zone from the list." }),
  })
  .superRefine((v, ctx) => {
    const { day, month, year } = v.birthday;
    if (
      !isRealDayMonth(day, month) ||
      (year !== null && day === 29 && month === 2 && !isLeapYear(year))
    ) {
      ctx.addIssue({ code: "custom", path: ["birthday"], message: "That date doesn't exist." });
    }
  });

export type AboutValues = z.input<typeof aboutSchema>;
export type LookValues = z.input<typeof lookSchema>;

/** Field errors for the form: first message per field. */
export function profileErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Change email: a real address, different from the current one. */
export const emailChangeSchema = z.object({
  email: z.email({ error: "That doesn't look like an email address." }).max(254),
  password: z.string().max(200).optional(),
});

/** Change password: the current one (checked) and a new one of 8+ characters. */
export const passwordChangeSchema = z.object({
  current: z.string().min(1, { error: "Your current password, please." }).max(200),
  next: z.string().min(8, { error: "At least 8 characters." }).max(200),
});

/** Delete account: you type your email; email accounts also give their password. */
export const deleteAccountSchema = z.object({
  email: z.string().trim().max(254),
  password: z.string().max(200).optional(),
});

export { REAUTH_WINDOW_SECONDS, signedInRecently } from "./schema-reauth";

export const REAUTH_MESSAGE = "Please log in again to continue.";
