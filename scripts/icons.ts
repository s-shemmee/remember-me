/**
 * pnpm icons: renders every icon from the one mark (scripts/icons/specs.ts,
 * src/lib/logo-mark.ts), then commit the files:
 *
 * - src/app/icon.svg          the browser tab icon (Next adds the <link>)
 * - src/app/favicon.ico       16 and 32px fallback
 * - public/apple-touch-icon.png, public/icons/*  (PWA: any, maskable, badge)
 * - public/email/logo.png     the email header logo
 *
 * Renders with Playwright: your installed Edge locally, Chromium in CI.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

import {
  FAVICON_FILE,
  FAVICON_SIZES,
  faviconSpec,
  ICON_SVG_FILE,
  iconSvg,
  iconSvgFile,
  type IconSpec,
  packIco,
  PNG_ICONS,
} from "./icons/specs.ts";

const root = path.resolve(import.meta.dirname, "..");

async function render(page: Page, spec: IconSpec): Promise<Buffer> {
  await page.setViewportSize({ width: spec.size, height: spec.size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${iconSvg(spec.shape, spec.heart, spec.size)}</body></html>`,
  );
  return page.locator("svg").first().screenshot({ omitBackground: true });
}

function write(file: string, data: string | Uint8Array) {
  const full = path.join(root, file);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, data);
  console.log(`  ${file}`);
}

const browser = await chromium.launch(process.env.CI ? {} : { channel: "msedge" });
const page = await browser.newPage({ deviceScaleFactor: 1 });

console.log("Writing icons:");
write(ICON_SVG_FILE, iconSvgFile());
const frames = [];
for (const size of FAVICON_SIZES) frames.push({ size, png: await render(page, faviconSpec(size)) });
write(FAVICON_FILE, packIco(frames));
for (const spec of PNG_ICONS) write(spec.file, await render(page, spec));

await browser.close();
