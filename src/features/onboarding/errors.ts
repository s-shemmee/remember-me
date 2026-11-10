/**
 * complete_onboarding() raises errcode 22023 with a short code as the
 * message. Map each to friendly copy and the step it belongs to.
 */
const BY_CODE: Record<string, { step: number; message: string }> = {
  invalid_first_name: { step: 0, message: "Your name needs a quick look." },
  invalid_birthday: { step: 0, message: "That birthday doesn't look right." },
  invalid_birth_year: { step: 0, message: "That birth year doesn't look right." },
  invalid_avatar: { step: 1, message: "Let's pick your look again." },
  person_name_required: { step: 2, message: "Your person needs a name, or skip this step." },
  invalid_person: { step: 2, message: "Something about your person needs a quick look." },
  invalid_person_birthday: { step: 2, message: "Their birthday doesn't look right." },
  invalid_reminders: { step: 3, message: "Pick when I should nudge you." },
};

export type OnboardingErrorInfo =
  | { kind: "step"; step: number; message: string }
  | { kind: "already_onboarded" }
  | { kind: "signed_out" }
  | { kind: "unknown"; message: string };

export function onboardingError(message: string | undefined): OnboardingErrorInfo {
  if (message === "already_onboarded") return { kind: "already_onboarded" };
  if (message === "not_authenticated") return { kind: "signed_out" };
  const known = message ? BY_CODE[message] : undefined;
  if (known) return { kind: "step", ...known };
  return { kind: "unknown", message: "Something went wrong on our side. Please try again." };
}
