import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  forgetThemeUser,
  getThemeChoice,
  parseThemeChoice,
  resolveIsDark,
  setThemeChoice,
  shouldAdoptProfileTheme,
  syncProfileTheme,
  THEME_STORAGE_KEY,
  THEME_USER_KEY,
  themeScript,
} from "./theme";

/** A controllable prefers-color-scheme media query. */
function mockSystemDark(initial: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql = {
    matches: initial,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.delete(fn),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
  return {
    set(dark: boolean) {
      mql.matches = dark;
      listeners.forEach((fn) => fn({ matches: dark }));
    },
  };
}

const root = () => document.documentElement;
const runInlineScript = () => new Function(themeScript)();

beforeEach(() => {
  localStorage.clear();
  root().className = "";
  root().style.colorScheme = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("theme choice", () => {
  it("falls back to light for anything unknown", () => {
    expect(parseThemeChoice("dark")).toBe("dark");
    expect(parseThemeChoice("light")).toBe("light");
    expect(parseThemeChoice("system")).toBe("system");
    expect(parseThemeChoice(null)).toBe("light");
    expect(parseThemeChoice("purple")).toBe("light");
  });

  it.each([
    ["light", false, false],
    ["light", true, false],
    ["dark", false, true],
    ["dark", true, true],
    ["system", false, false],
    ["system", true, true],
  ] as const)("%s with system dark=%s resolves to dark=%s", (choice, systemDark, expected) => {
    expect(resolveIsDark(choice, systemDark)).toBe(expected);
  });
});

describe("inline head script", () => {
  it("starts in light when nothing is saved, even on a dark system", () => {
    mockSystemDark(true);
    runInlineScript();
    expect(root()).not.toHaveClass("dark");
    expect(root().style.colorScheme).toBe("light");
  });

  it("follows the system when the saved choice is system", () => {
    mockSystemDark(true);
    localStorage.setItem(THEME_STORAGE_KEY, "system");
    runInlineScript();
    expect(root()).toHaveClass("dark");
    expect(root().style.colorScheme).toBe("dark");
  });

  it("uses the saved choice over the system", () => {
    mockSystemDark(true);
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    runInlineScript();
    expect(root()).not.toHaveClass("dark");
    expect(root().style.colorScheme).toBe("light");
  });

  it("follows live system changes while the choice is system", () => {
    const system = mockSystemDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, "system");
    runInlineScript();
    expect(root()).not.toHaveClass("dark");

    system.set(true);
    expect(root()).toHaveClass("dark");
    system.set(false);
    expect(root()).not.toHaveClass("dark");
  });

  it("ignores system changes once the person picked a theme", () => {
    const system = mockSystemDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    runInlineScript();

    system.set(true);
    expect(root()).not.toHaveClass("dark");
  });

  it("does not throw when storage is blocked", () => {
    mockSystemDark(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(runInlineScript).not.toThrow();
    expect(root()).not.toHaveClass("dark");
    vi.restoreAllMocks();
  });
});

describe("setThemeChoice", () => {
  it("saves and applies the choice at once", () => {
    mockSystemDark(false);
    setThemeChoice("dark");
    expect(getThemeChoice()).toBe("dark");
    expect(root()).toHaveClass("dark");

    setThemeChoice("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(root()).not.toHaveClass("dark");
  });

  it("reads light when nothing is saved", () => {
    expect(getThemeChoice()).toBe("light");
  });

  it("keeps following the system after switching back to system", () => {
    const system = mockSystemDark(false);
    runInlineScript();
    setThemeChoice("light");
    system.set(true);
    expect(root()).not.toHaveClass("dark");

    setThemeChoice("system");
    expect(root()).toHaveClass("dark");
    system.set(false);
    expect(root()).not.toHaveClass("dark");
  });
});

describe("profile theme vs this device", () => {
  const ME = "user-1";

  it("adopts the profile only on a new device or a fresh log-in", () => {
    expect(shouldAdoptProfileTheme({ choice: null, user: null }, ME)).toBe(true);
    expect(shouldAdoptProfileTheme({ choice: "dark", user: null }, ME)).toBe(true);
    expect(shouldAdoptProfileTheme({ choice: "dark", user: "someone-else" }, ME)).toBe(true);
    expect(shouldAdoptProfileTheme({ choice: "dark", user: ME }, ME)).toBe(false);
  });

  it("takes the profile theme on a new device and remembers whose it is", () => {
    mockSystemDark(false);
    syncProfileTheme("dark", ME);
    expect(getThemeChoice()).toBe("dark");
    expect(localStorage.getItem(THEME_USER_KEY)).toBe(ME);
    expect(root()).toHaveClass("dark");
  });

  it("never flips the device back with a stale profile value", () => {
    mockSystemDark(false);
    syncProfileTheme("light", ME);
    setThemeChoice("dark"); // the toggle
    // Navigations re-render the layout with the old profile value.
    syncProfileTheme("light", ME);
    syncProfileTheme("light", ME);
    expect(getThemeChoice()).toBe("dark");
    expect(root()).toHaveClass("dark");
  });

  it("takes the profile again after logging out and back in", () => {
    mockSystemDark(false);
    syncProfileTheme("light", ME);
    setThemeChoice("dark");
    forgetThemeUser();
    expect(localStorage.getItem(THEME_USER_KEY)).toBeNull();
    syncProfileTheme("light", ME);
    expect(getThemeChoice()).toBe("light");
  });
});
