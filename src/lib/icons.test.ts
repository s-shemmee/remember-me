import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

import {
  FAVICON_FILE,
  FAVICON_SIZES,
  ICON_SVG_FILE,
  iconSvgFile,
  PNG_ICONS,
  readIco,
} from "../../scripts/icons/specs";

/**
 * The icon files are ours and in step with the one mark (src/lib/logo-mark.ts).
 * e2e/logo.spec.ts compares their pixels with a fresh render; this checks the
 * files themselves: the tab SVG, the favicon frames, and every size used.
 */
const root = path.resolve(__dirname, "../..");
const read = (file: string) => new Uint8Array(readFileSync(path.join(root, file)));
const pngSize = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect([...bytes.subarray(1, 4)].map((c) => String.fromCharCode(c)).join("")).toBe("PNG");
  return [view.getUint32(16), view.getUint32(20)];
};

describe("icons", () => {
  it("src/app/icon.svg is the generated mark (run `pnpm icons` after changing the logo)", () => {
    expect(readFileSync(path.join(root, ICON_SVG_FILE), "utf8")).toBe(iconSvgFile());
  });

  it("favicon.ico holds our 16 and 32px PNG frames, not the template's bitmaps", () => {
    const frames = readIco(read(FAVICON_FILE));
    expect(frames.map((f) => f.size)).toEqual([...FAVICON_SIZES]);
    for (const f of frames) {
      expect(f.png, `${f.size}px frame`).toBe(true);
      expect(pngSize(f.data)).toEqual([f.size, f.size]);
    }
  });

  it("every PNG icon has its stated size", () => {
    for (const spec of PNG_ICONS)
      expect(pngSize(read(spec.file)), spec.file).toEqual([spec.size, spec.size]);
  });

  it("the manifest's icons exist at the sizes it says", () => {
    const icons = manifest().icons ?? [];
    expect(icons.length).toBeGreaterThanOrEqual(4);
    for (const icon of icons) {
      const [w, h] = pngSize(read(path.join("public", icon.src)));
      expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
      expect(PNG_ICONS.some((s) => s.file === path.posix.join("public", icon.src))).toBe(true);
    }
  });
});
