import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseThemes, type TokenMap } from "./parse-tokens";
import { pastels } from "./tokens";

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const themes = parseThemes(css);

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("design tokens", () => {
  it("defines every light token in dark mode too, and nothing extra", () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  describe.each(["light", "dark"] as const)("%s theme contrast", (theme) => {
    const t: TokenMap = themes[theme];
    const pairs: [string, string][] = [
      ["text", "bg"],
      ["text", "card"],
      ["sub", "bg"],
      ["sub", "card"],
      ["accentText", "bg"],
      ["accentText", "card"],
      ["onAccent", "accent"],
      ...pastels.map((p): [string, string] => [`${p}-ink`, p]),
    ];

    it.each(pairs)("%s on %s is at least 4.5:1", (fg, bg) => {
      expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
    });

    // The accent is also the focus ring: a UI part, so 3:1 against the page.
    it("accent on bg is at least 3:1", () => {
      expect(contrast(t.accent!, t.bg!)).toBeGreaterThanOrEqual(3);
    });
  });
});
