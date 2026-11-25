/** Noor's chat: the thread's items and what Noor offers next (pure types and copy). */

export type Item = {
  id: string;
  from: "me" | "noor";
  text: string;
  tone?: "info" | "error";
  /** Help answers: the help pages they came from. */
  sources?: { url: string; title: string }[];
};

/** Elsewhere than a person's page: common help questions. */
export const HELP_CHIPS = [
  "How do invites work?",
  "Can someone see who reserved my gift?",
  "How do reminders work?",
] as const;
