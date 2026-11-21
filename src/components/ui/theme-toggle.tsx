"use client";

import { MoonIcon, SunIcon } from "lucide-react";

import { setThemeChoice, type ThemeChoice } from "@/lib/theme";
import { useIsDark } from "@/lib/use-theme";

import { Button } from "./button";

/** One-tap light/dark switch, a 44px card2 circle as in the approved screens (the full Light / Dark / System choice lives in Settings). */
function ThemeToggle({
  className,
  onChange,
}: {
  className?: string;
  /** Called after switching, e.g. to save the choice to the profile. */
  onChange?: (choice: ThemeChoice) => void;
}) {
  const isDark = useIsDark();
  return (
    <Button
      variant="card2"
      size="icon"
      className={className}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const choice = isDark ? "light" : "dark";
        setThemeChoice(choice);
        onChange?.(choice);
      }}
    >
      {isDark ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
    </Button>
  );
}

export { ThemeToggle };
