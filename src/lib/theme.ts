/**
 * Theme without a flash and without next-themes.
 *
 * `themeScript` runs inline in <head> before the first paint. It reads the
 * saved choice ("light" | "dark" | "system", default "light"), puts the
 * `.dark` class on <html> and keeps following the OS while the choice is
 * "system". `setThemeChoice` saves a new choice and applies it at once.
 *
 * One source of truth: this device's choice (localStorage). The profile's
 * theme only replaces it on a new device or right after logging in
 * (`shouldAdoptProfileTheme`, with THEME_USER_KEY), never on a navigation.
 */

export const THEME_STORAGE_KEY = "rm-theme";
export const THEME_CHANGE_EVENT = "rm-theme-change";
/** Whose profile theme this device last took (cleared on log out). */
export const THEME_USER_KEY = "rm-theme-user";
/** New users and signed-out pages: light. Dark and System are a choice away. */
export const DEFAULT_THEME = "light";
export const themeChoices = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof themeChoices)[number];

export function parseThemeChoice(value: unknown): ThemeChoice {
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_THEME;
}

export function resolveIsDark(choice: ThemeChoice, systemDark: boolean): boolean {
  return choice === "dark" || (choice === "system" && systemDark);
}

/**
 * Self-contained ES5 so it can run before any bundle loads. Kept in sync with
 * the functions above by src/lib/theme.test.ts, which executes this string.
 */
export const themeScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)},d=document.documentElement,m=window.matchMedia("(prefers-color-scheme: dark)");function c(){var v=null;try{v=localStorage.getItem(k)}catch(e){}return v==="light"||v==="dark"||v==="system"?v:"light"}function a(){var v=c(),x=v==="dark"||(v==="system"&&m.matches);d.classList.toggle("dark",x);d.style.colorScheme=x?"dark":"light"}a();m.addEventListener("change",function(){if(c()==="system")a()});window.addEventListener("storage",function(e){if(e.key===k)a()})}catch(e){}})();`;

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
    return DEFAULT_THEME;
  }
}

/**
 * Should this device take the profile's theme? Only when it has no choice of
 * its own yet (a new device) or the theme was last adopted for someone else /
 * nobody (just logged in). Otherwise the device's own choice wins, so a stale
 * profile value from a page render can never flip it back.
 */
export function shouldAdoptProfileTheme(
  stored: { choice: string | null; user: string | null },
  userId: string,
): boolean {
  return stored.choice === null || stored.user !== userId;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Takes the profile's theme if this is a new device or a fresh log-in (see above). */
export function syncProfileTheme(profileTheme: ThemeChoice, userId: string): void {
  const stored = { choice: readStorage(THEME_STORAGE_KEY), user: readStorage(THEME_USER_KEY) };
  if (!shouldAdoptProfileTheme(stored, userId)) return;
  try {
    localStorage.setItem(THEME_USER_KEY, userId);
  } catch {
    // Blocked storage: nothing to remember.
  }
  if (stored.choice !== profileTheme) setThemeChoice(profileTheme);
}

/** On log out: the next log-in on this device takes that account's theme. */
export function forgetThemeUser(): void {
  try {
    localStorage.removeItem(THEME_USER_KEY);
  } catch {
    // Nothing to forget.
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
