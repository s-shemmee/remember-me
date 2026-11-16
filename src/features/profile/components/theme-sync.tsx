"use client";

import * as React from "react";

import { getThemeChoice, setThemeChoice, type ThemeChoice } from "@/lib/theme";

/**
 * Keeps this device in step with the theme saved on your profile (set in
 * Settings → Appearance on any device). The head script already applied
 * this device's last choice before paint, so a change here is rare: only
 * the first visit on a new device, or after changing it elsewhere.
 */
export function ThemeSync({ theme }: { theme: ThemeChoice }) {
  React.useEffect(() => {
    if (getThemeChoice() !== theme) setThemeChoice(theme);
  }, [theme]);
  return null;
}
