/**
 * Theme without a flash and without next-themes.
 *
 * `themeScript` runs inline in <head> before the first paint. It reads the
 * saved choice ("light" | "dark" | "system", default "system"), puts the
 * `.dark` class on <html> and keeps following the OS while the choice is
 * "system". `setThemeChoice` saves a new choice and applies it at once.
 */

export const THEME_STORAGE_KEY = "rm-theme";
export const THEME_CHANGE_EVENT = "rm-theme-change";
export const themeChoices = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof themeChoices)[number];

export function parseThemeChoice(value: unknown): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveIsDark(choice: ThemeChoice, systemDark: boolean): boolean {
  return choice === "dark" || (choice === "system" && systemDark);
}

/**
 * Self-contained ES5 so it can run before any bundle loads. Kept in sync with
 * the functions above by src/lib/theme.test.ts, which executes this string.
 */
export const themeScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)},d=document.documentElement,m=window.matchMedia("(prefers-color-scheme: dark)");function c(){var v=null;try{v=localStorage.getItem(k)}catch(e){}return v==="light"||v==="dark"?v:"system"}function a(){var v=c(),x=v==="dark"||(v==="system"&&m.matches);d.classList.toggle("dark",x);d.style.colorScheme=x?"dark":"light"}a();m.addEventListener("change",function(){if(c()==="system")a()});window.addEventListener("storage",function(e){if(e.key===k)a()})}catch(e){}})();`;

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(choice: ThemeChoice): void {
  const isDark = resolveIsDark(choice, systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
}

export function getThemeChoice(): ThemeChoice {
  try {
    return parseThemeChoice(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Private mode or blocked storage: still apply for this page view.
  }
  applyTheme(choice);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
