import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Hover tints a control's own colour (`hover-tint`, globals.css), never
 * swaps in a surface colour: a surface-coloured hover vanishes on that
 * surface (the "Plan their day" bug). See docs/decisions.md, UI polish.
 */
const SRC = path.resolve(__dirname, "../..");
const SURFACE_HOVER = /hover:bg-(bg|card2?|line)(\/\d+)?\b/g;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return files(p);
    return /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name) ? [p] : [];
  });
}

describe("hover rule", () => {
  it("no component hovers to a surface colour", () => {
    const offenders = files(SRC).flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(SURFACE_HOVER)].map(
        (m) => `${path.relative(SRC, f)}: ${m[0]}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("hover-tint is a 9% text-colour overlay by default (a variant may tune it)", () => {
    const css = readFileSync(path.join(SRC, "app/globals.css"), "utf8");
    expect(css).toMatch(
      /@utility hover-tint[\s\S]*?color-mix\(in srgb, var\(--hover-tint-color, var\(--text\)\) var\(--hover-tint, 9%\), transparent\)/,
    );
  });
});
