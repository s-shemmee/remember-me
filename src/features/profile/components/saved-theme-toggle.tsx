"use client";

import { ThemeToggle } from "@/components/ui/theme-toggle";

import { saveTheme } from "../actions";

/**
 * The light/dark toggle inside the app. This device's choice changes at once
 * (it's the source of truth here); the profile is saved too, so a new device
 * or the next log-in starts with it.
 */
export function SavedThemeToggle({ className }: { className?: string }) {
  return <ThemeToggle className={className} onChange={(choice) => void saveTheme(choice)} />;
}
