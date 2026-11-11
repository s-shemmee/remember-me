import { z } from "zod";

import { REMINDER_DAYS } from "@/features/onboarding/constants";

/** Reminder settings from Settings: which days before, and email on or off. */
export const reminderSettingsSchema = z.object({
  offsets: z
    .array(z.number().int())
    .max(5)
    .refine((list) => list.every((d) => (REMINDER_DAYS as readonly number[]).includes(d)), {
      error: "Pick from the options shown.",
    })
    .refine((list) => new Set(list).size === list.length, { error: "Each option once." })
    .transform((list) => [...list].sort((a, b) => b - a)),
  email: z.boolean(),
});

export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;

/** What the Settings card says after "Send me a test email". */
export function testEmailMessage(result: { ok: true; to: string } | { ok: false; code: string }) {
  if (result.ok) return `Sent to ${result.to}. It can take a minute to arrive.`;
  if (result.code === "too_many") {
    return "That's 3 test emails this hour. Please try again a little later.";
  }
  return "I couldn't send it just now. Please try again in a minute.";
}
