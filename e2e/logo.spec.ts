import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";

import { PASSWORD } from "./helpers";

/**
 * The logo is the same mark everywhere: the in-app Logo (sidebar, phone
 * header, landing, auth, offline), the PWA icons, the favicon and the email
 * PNG. The heart is centred in its square (within half a pixel), light and
 * dark, and emails use the real image.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** The white heart's box in an image, measured in the browser. */
async function heartBox(page: Page, file: string) {
  const type = file.endsWith(".ico") ? "image/x-icon" : "image/png";
  const b64 = readFileSync(file).toString("base64");
  return page.evaluate(
    async ({ b64, type }) => {
      const img = new Image();
      img.src = `data:${type};base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let [x0, x1, y0, y1] = [Infinity, -1, Infinity, -1];
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          if (d[i + 3]! > 128 && d[i]! > 230 && d[i + 1]! > 230 && d[i + 2]! > 230) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
        }
      return { w: c.width, h: c.height, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2, found: x1 >= 0 };
    },
    { b64, type },
  );
}

test("every icon file has the heart centred", async ({ page }) => {
  await page.goto("/log-in");
  for (const file of [
    "src/app/favicon.ico",
    "public/apple-touch-icon.png",
    "public/icons/icon-192.png",
    "public/icons/icon-512.png",
    "public/icons/maskable-192.png",
    "public/icons/maskable-512.png",
    "public/icons/badge-96.png",
    "public/email/logo.png",
  ]) {
    const box = await heartBox(page, file);
    expect(box.found, file).toBe(true);
    expect(Math.abs(box.cx - box.w / 2), `${file} x`).toBeLessThanOrEqual(1);
    expect(Math.abs(box.cy - box.h / 2), `${file} y`).toBeLessThanOrEqual(1);
  }
});

for (const theme of ["light", "dark"] as const) {
  test(`the in-app logo: heart centred in the square (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("rm-theme", t), theme);
    for (const [path, width] of [
      ["/", 1440],
      ["/", 390],
      ["/log-in", 390],
      ["/sign-up", 1440],
      ["/offline", 390],
    ] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      const square = page.locator("span.bg-accent:has(> svg)").filter({ visible: true }).first();
      await expect(square).toBeVisible();
      const [s, h] = await Promise.all([
        square.boundingBox(),
        square.locator("svg path").boundingBox(),
      ]);
      const where = `${path} at ${width}`;
      expect(Math.abs(s!.x + s!.width / 2 - (h!.x + h!.width / 2)), `${where} x`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(s!.y + s!.height / 2 - (h!.y + h!.height / 2)), `${where} y`).toBeLessThanOrEqual(0.5);
      // Square and heart contrast (light: red/white, dark: pink/ink).
      const [bg, fill] = await Promise.all([
        square.evaluate((el) => getComputedStyle(el).backgroundColor),
        square.locator("svg").evaluate((el) => getComputedStyle(el).fill),
      ]);
      expect(bg, where).not.toBe(fill);
    }
  });
}

test("emails use the real logo image, served without a session", async ({ page, request }) => {
  const png = await request.get("/email/logo.png");
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toContain("image/png");

  // A sign-up confirmation (our auth template, via local Supabase) in Mailpit.
  const email = `e2e.logo.${Date.now()}@test.local`;
  await page.goto("/sign-up");
  await page.getByLabel("What should we call you?").fill("Lina");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/\/check-email$/);

  let html = "";
  for (let i = 0; i < 30 && !html; i++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages = [] } = (await search.json()) as { messages?: { ID: string }[] };
    if (messages[0]) {
      html = ((await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { HTML: string }).HTML;
    } else {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const img = html.match(/<td[^>]*bgcolor="#d63b48"[^>]*><img[^>]*><\/td>/)?.[0];
  expect(img).toBeDefined();
  expect(img).toContain('alt=""');
  const src = img!.match(/src="([^"]+)"/)![1]!;
  expect(src).toMatch(/\/email\/logo\.png$/);
  expect((await request.get(src)).status()).toBe(200);
  expect(html).not.toMatch(/&#9829;|♥/);

  // Seen as an inbox would show it.
  await page.setContent(html);
  await expect(page.locator("img[alt='']").first()).toHaveJSProperty("complete", true);
  expect(await page.locator("img[alt='']").first().evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(56);
});
