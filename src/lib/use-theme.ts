"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_THEME, getThemeChoice, THEME_CHANGE_EVENT, type ThemeChoice } from "./theme";

function subscribeToDarkClass(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** True while <html> has `.dark`. Server render assumes light. */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribeToDarkClass,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

function subscribeToChoice(onChange: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The saved choice (the default, light, on the server and before hydration). */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribeToChoice, getThemeChoice, () => DEFAULT_THEME);
}
