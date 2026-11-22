/** Noor's chat: the thread's items and what Noor offers next (pure types and copy). */

export type Item =
  | {
      id: string;
      from: "me" | "noor";
      kind: "text";
      text: string;
      tone?: "info" | "error";
      /** Help answers: the help pages they came from. */
      sources?: { url: string; title: string }[];
    }
  | { id: string; from: "noor"; kind: "ideas"; ideas: { title: string; why: string }[] }
  | { id: string; from: "noor"; kind: "drafts"; drafts: string[] };

/** The chips above the input: a budget, a tone, a language, or nothing to pick. */
export type Step =
  | { kind: "idle" }
  | { kind: "budget" }
  | { kind: "tone" }
  | { kind: "language"; tone: import("@/ai/messages/prompt").Tone };

/** Elsewhere than a person's page: common help questions. */
export const HELP_CHIPS = [
  "How do invites work?",
  "Can someone see who reserved my gift?",
  "How do reminders work?",
] as const;
