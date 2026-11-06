"use client";

import { MoonIcon, SunIcon } from "lucide-react";

import { setThemeChoice } from "@/lib/theme";
import { useIsDark } from "@/lib/use-theme";

import { Button } from "./button";

/** One-tap light/dark switch (the full Light / Dark / System choice lives in Settings). */
function ThemeToggle({ className }: { className?: string }) {
  const isDark = useIsDark();
  return (
    <Button
      variant="transparent"
      size="icon"
      className={className}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setThemeChoice(isDark ? "light" : "dark")}
    >
      {isDark ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
    </Button>
  );
}

export { ThemeToggle };
