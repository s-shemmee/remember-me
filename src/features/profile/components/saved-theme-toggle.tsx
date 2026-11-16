"use client";

import { ThemeToggle } from "@/components/ui/theme-toggle";

import { saveTheme } from "../actions";

/** The light/dark toggle inside the app: also saves the choice to your profile. */
export function SavedThemeToggle({ className }: { className?: string }) {
  return <ThemeToggle className={className} onChange={(choice) => void saveTheme(choice)} />;
}
