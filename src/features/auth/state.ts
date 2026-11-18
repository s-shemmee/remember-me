/** What a form's Server Action hands back to the form (useActionState). */
export type AuthFormState<Field extends string = string> = {
  /** One message per field, shown under it and linked with aria-describedby. */
  fieldErrors?: Partial<Record<Field, string>>;
  /** A message for the whole form, shown above the submit button. */
  formError?: string;
  /** Which kind of form error, when it comes with its own links (log in). */
  kind?: "badLogin" | "notConfirmed";
  /** A Resend button may send again from this time (ms since epoch). */
  cooldownUntil?: number;
  /** A calm success note (e.g. "we sent a link"). */
  notice?: string;
  /** Values to keep in the fields after a failed submit (never passwords). */
  values?: Partial<Record<Field, string>>;
};

export const initialAuthState: AuthFormState = {};

export function fieldErrorsFrom<Field extends string>(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  for (const issue of issues) {
    const field = String(issue.path[0]) as Field;
    errors[field] ??= issue.message;
  }
  return errors;
}
