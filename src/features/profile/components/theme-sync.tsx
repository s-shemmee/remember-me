"use client";

import * as React from "react";

import { syncProfileTheme, type ThemeChoice } from "@/lib/theme";

/**
 * The profile's theme (Settings → Appearance, or the toggle on another
 * device) replaces this device's choice only on a new device or right after
 * logging in. After that the device's own choice wins: a page render that
 * still carries an older profile value can't flip the theme back.
 */
export function ThemeSync({ theme, userId }: { theme: ThemeChoice; userId: string }) {
  React.useEffect(() => {
    syncProfileTheme(theme, userId);
  }, [theme, userId]);
  return null;
}
