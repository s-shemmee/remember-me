/**
 * save_person() raises errcode 22023 (or P0002 for not_found) with a short
 * code as the message. Map each to friendly copy and, where it belongs to
 * one field, that field.
 */
const BY_CODE: Record<string, { message: string; field?: string }> = {
  invalid_name: { message: "Their name needs a quick look.", field: "name" },
  invalid_relation: {
    message: "How you'd describe them needs a quick look.",
    field: "description",
  },
  invalid_color: { message: "Pick one of the colours." },
  invalid_little_things: { message: "One of the little things needs a quick look." },
  invalid_birthday: { message: "Their birthday doesn't look right.", field: "day" },
  invalid_days: { message: "One of their other days doesn't look right." },
  not_found: { message: "I couldn't find them. They may have been removed." },
};

export type PersonErrorInfo =
  | { kind: "known"; message: string; field?: string }
  | { kind: "signed_out" }
  | { kind: "unknown"; message: string };

export function personError(message: string | undefined): PersonErrorInfo {
  if (message === "not_authenticated") return { kind: "signed_out" };
  const known = message ? BY_CODE[message] : undefined;
  if (known) return { kind: "known", ...known };
  return { kind: "unknown", message: "Something went wrong on our side. Please try again." };
}
