"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Pastel } from "@/styles/tokens";

import {
  type CharacterKey,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_REMINDER_OFFSETS,
  type Relation,
} from "./constants";

/**
 * The onboarding draft (the only Zustand store in the app, per AGENTS.md).
 * Kept in sessionStorage so a refresh doesn't lose it; cleared when
 * onboarding finishes and on log out. Tied to one user: if someone else
 * signs in on the same tab, their onboarding starts fresh.
 */

export const ONBOARDING_DRAFT_KEY = "rm-onboarding-draft";

export type OnboardingDraft = {
  ownerId: string | null;
  step: number;
  you: { firstName: string; day: number | null; month: number | null; year: number | null };
  look: { kind: "initials" | "character"; color: Pastel; character: CharacterKey | null };
  person: {
    skipped: boolean;
    name: string;
    relation: Relation;
    /** "How you'd describe them" (optional), e.g. "Little sister". */
    description: string;
    day: number | null;
    month: number | null;
    year: number | null;
    littleThing: string;
  };
  reminders: { offsets: number[]; email: boolean; push: boolean };
};

type Actions = {
  /** Start (or resume) the draft for this user, prefilling their first name. */
  begin: (ownerId: string, firstName: string) => void;
  setStep: (step: number) => void;
  setYou: (patch: Partial<OnboardingDraft["you"]>) => void;
  setLook: (patch: Partial<OnboardingDraft["look"]>) => void;
  setPerson: (patch: Partial<OnboardingDraft["person"]>) => void;
  setReminders: (patch: Partial<OnboardingDraft["reminders"]>) => void;
  reset: () => void;
};

export const emptyDraft = (): OnboardingDraft => ({
  ownerId: null,
  step: 0,
  you: { firstName: "", day: null, month: null, year: null },
  look: { kind: "initials", color: DEFAULT_AVATAR_COLOR, character: null },
  person: {
    skipped: false,
    name: "",
    relation: "Best friend",
    description: "",
    day: null,
    month: null,
    year: null,
    littleThing: "",
  },
  reminders: { offsets: [...DEFAULT_REMINDER_OFFSETS], email: true, push: false },
});

export const useOnboardingDraft = create<OnboardingDraft & Actions>()(
  persist(
    (set, get) => ({
      ...emptyDraft(),
      begin: (ownerId, firstName) => {
        const current = get();
        if (current.ownerId !== ownerId) {
          set({ ...emptyDraft(), ownerId, you: { ...emptyDraft().you, firstName } });
        } else if (!current.you.firstName && firstName) {
          set({ you: { ...current.you, firstName } });
        }
      },
      setStep: (step) => set({ step }),
      setYou: (patch) => set((s) => ({ you: { ...s.you, ...patch } })),
      setLook: (patch) => set((s) => ({ look: { ...s.look, ...patch } })),
      setPerson: (patch) => set((s) => ({ person: { ...s.person, ...patch } })),
      setReminders: (patch) => set((s) => ({ reminders: { ...s.reminders, ...patch } })),
      reset: () => set(emptyDraft()),
    }),
    {
      name: ONBOARDING_DRAFT_KEY,
      storage: createJSONStorage(() => sessionStorage),
      version: 1,
      partialize: ({ ownerId, step, you, look, person, reminders }) => ({
        ownerId,
        step,
        you,
        look,
        person,
        reminders,
      }),
    },
  ),
);

/** Remove the draft from storage (log out, or after finishing). */
export function clearOnboardingDraft() {
  try {
    sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    // Storage blocked: nothing to clear.
  }
  useOnboardingDraft.getState().reset();
}
