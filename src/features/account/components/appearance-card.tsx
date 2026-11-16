"use client";

import * as React from "react";

import { ChoiceGroup, ChoiceItem } from "@/components/ui/choice-group";
import { saveTheme } from "@/features/profile/actions";
import { getThemeChoice, setThemeChoice, THEME_CHANGE_EVENT, type ThemeChoice } from "@/lib/theme";

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const subscribe = (onChange: () => void) => {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

/**
 * Settings → Appearance: Light, Dark or System. Applied at once (and before
 * paint on every later load, by the head script), saved to your profile so
 * your other devices follow.
 */
export function AppearanceCard({ saved }: { saved: ThemeChoice }) {
  const choice = React.useSyncExternalStore(subscribe, getThemeChoice, () => saved);
  const [status, setStatus] = React.useState("");

  const change = async (value: string) => {
    const next = value as ThemeChoice;
    setThemeChoice(next);
    const result = await saveTheme(next);
    setStatus(result.ok ? "Saved ✓" : result.message);
  };

  return (
    <section
      id="appearance"
      aria-labelledby="appearance-title"
      className="flex scroll-mt-6 flex-col gap-4 rounded-card-lg bg-card p-6 shadow-card sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="appearance-title" className="text-22 font-extrabold tracking-[-0.02em]">
            <span aria-hidden>🎨 </span>Appearance
          </h2>
          <p className="text-15 text-sub">Make it feel like yours</p>
        </div>
        <p role="status" aria-live="polite" className="min-h-6 text-14 font-semibold text-sub">
          {status}
        </p>
      </div>
      <ChoiceGroup aria-label="Theme" value={choice} onValueChange={(v) => void change(v)}>
        {CHOICES.map((c) => (
          <ChoiceItem
            key={c.value}
            value={c.value}
            className="inline-flex min-h-11 items-center rounded-pill bg-card2 px-5 text-15 font-semibold text-text data-[state=checked]:bg-text data-[state=checked]:text-bg"
          >
            {c.label}
          </ChoiceItem>
        ))}
      </ChoiceGroup>
      <p className="text-14 text-sub">System follows your device&apos;s light or dark setting.</p>
    </section>
  );
}
