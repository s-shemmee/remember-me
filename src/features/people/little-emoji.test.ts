import { describe, expect, it } from "vitest";

import {
  DEFAULT_EMOJI,
  EMOJI_GRID,
  isSingleEmoji,
  littleThingsOf,
  suggestEmoji,
} from "./little-emoji";

describe("little things: emoji", () => {
  it("exactly one emoji grapheme, at most 16 bytes", () => {
    for (const ok of ["⚽", "☕", "❤️", "👩🏽‍💻", "🇲🇦", "🧗"]) expect(isSingleEmoji(ok), ok).toBe(true);
    for (const bad of ["", "a", "⚽⚽", " ⚽", "x☕", "1", "#", "👨‍👩‍👧‍👦"]) {
      expect(isSingleEmoji(bad), bad).toBe(false);
    }
  });

  it("the grid: about 48 common emoji, all valid, no duplicates, each named", () => {
    expect(EMOJI_GRID.length).toBe(48);
    expect(new Set(EMOJI_GRID.map((g) => g.emoji)).size).toBe(48);
    for (const g of EMOJI_GRID) {
      expect(isSingleEmoji(g.emoji), g.name).toBe(true);
      expect(g.name.length).toBeGreaterThan(1);
    }
  });

  it("suggests from what's typed, locally", () => {
    expect(suggestEmoji("Black coffee, no sugar")).toBe("☕");
    expect(suggestEmoji("mint tea")).toBe("🍵");
    expect(suggestEmoji("Loves football")).toBe("⚽");
    expect(suggestEmoji("reading")).toBe("📚");
    expect(suggestEmoji("sci-fi novels")).toBe("🚀");
    expect(suggestEmoji("Sunflowers")).toBe("🌻");
    expect(suggestEmoji("her cats")).toBe("🐱");
    expect(suggestEmoji("old jazz music")).toBe("🎶");
    expect(suggestEmoji("pizza Fridays")).toBe("🍕");
    expect(suggestEmoji("gaming")).toBe("🎮");
    expect(suggestEmoji("travel")).toBe("✈️");
    expect(suggestEmoji("plants")).toBe("🪴");
    expect(suggestEmoji("the colour blue")).toBeNull();
    expect(suggestEmoji("   ")).toBeNull();
  });

  it("old rows without emoji get a heart", () => {
    expect(littleThingsOf(["tea", "cake"], ["🍵"])).toEqual([
      { text: "tea", emoji: "🍵" },
      { text: "cake", emoji: DEFAULT_EMOJI },
    ]);
    expect(littleThingsOf(["tea"], null)).toEqual([{ text: "tea", emoji: "❤️" }]);
  });
});
