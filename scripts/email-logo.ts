/**
 * Exports the email logo, public/email/logo.png: the mark (white heart in the
 * red rounded square) from src/lib/logo-mark.ts at 2× (56×56 for a 28px slot),
 * with transparent corners. Emails place it inside a red cell, so the square
 * still shows when images are blocked.
 *
 *   pnpm email:logo   (then commit the PNG)
 *
 * Renders with Playwright: your installed Edge locally, Chromium in CI.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

import { HEART_PATH, HEART_SCALE, HEART_VIEWBOX, LOGO_RED } from "../src/lib/logo-mark.ts";

const SIZE = 28; // CSS px in the email
const SCALE = 2;
const RADIUS = 8; // as the app's rounded-chip square at this size
const OUT = path.join(import.meta.dirname, "..", "public", "email", "logo.png");

const heart = SIZE * HEART_SCALE;
const html = `<!doctype html><html><body style="margin:0;background:transparent">
<div id="mark" style="width:${SIZE}px;height:${SIZE}px;border-radius:${RADIUS}px;background:${LOGO_RED};display:grid;place-items:center">
  <svg width="${heart}" height="${heart}" viewBox="${HEART_VIEWBOX}"><path fill="#ffffff" d="${HEART_PATH}"/></svg>
</div></body></html>`;

const browser = await chromium.launch(process.env.CI ? {} : { channel: "msedge" });
const page = await browser.newPage({ deviceScaleFactor: SCALE });
await page.setContent(html);
mkdirSync(path.dirname(OUT), { recursive: true });
await page.locator("#mark").screenshot({ path: OUT, omitBackground: true });
await browser.close();
console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${SIZE * SCALE}×${SIZE * SCALE})`);
