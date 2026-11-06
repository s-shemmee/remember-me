import { z } from "zod";

/** Matches Supabase Auth's minimum (supabase/config.toml and the dashboard). */
export const PASSWORD_MIN = 8;

const email = z
  .string()
  .trim()
  .min(1, { error: "Please enter your email." })
  .pipe(z.email({ error: "That email doesn't look right." }));

const newPassword = z
  .string()
  .min(PASSWORD_MIN, { error: `Use ${PASSWORD_MIN} characters or more.` })
  .max(72, { error: "That's a bit long. Use 72 characters or fewer." });

export const signUpSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { error: "What should we call you?" })
    .max(50, { error: "Keep it under 50 characters." }),
  email,
  password: newPassword,
});

export const logInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Please enter your password." }),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ password: newPassword });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LogInInput = z.infer<typeof logInSchema>;
