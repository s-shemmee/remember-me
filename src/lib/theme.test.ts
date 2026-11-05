import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getThemeChoice,
  parseThemeChoice,
  resolveIsDark,
  setThemeChoice,
  THEME_STORAGE_KEY,
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
  it("falls back to system for anything unknown", () => {
    expect(parseThemeChoice("dark")).toBe("dark");
    expect(parseThemeChoice("light")).toBe("light");
    expect(parseThemeChoice(null)).toBe("system");
    expect(parseThemeChoice("purple")).toBe("system");
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
  it("follows the system when nothing is saved", () => {
    mockSystemDark(true);
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
    expect(root()).toHaveClass("dark");
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
