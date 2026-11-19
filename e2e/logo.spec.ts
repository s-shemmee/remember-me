import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";

import {
  FAVICON_FILE,
  FAVICON_SIZES,
  faviconSpec,
  ICON_SVG_FILE,
  iconSvg,
  PNG_ICONS,
  readIco,
} from "../scripts/icons/specs";
import { PASSWORD } from "./helpers";

/**
 * The logo is the same mark everywhere: the in-app Logo (sidebar, phone
 * header, landing, auth, offline), the tab icon and favicon, the Apple touch
 * and PWA icons and the email PNG. Every icon file matches a fresh render of
 * its spec (scripts/icons/specs.ts); the heart is centred in the in-app logo
 * (within half a pixel), light and dark; emails use the real image.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/**
 * How far a committed icon is from a fresh render of its spec: the mean
 * difference per RGBA channel (0 = identical, 255 = opposite). Both are drawn
 * into same-size canvases in the browser.
 */
async function distance(page: Page, svg: string, size: number, png: Uint8Array) {
  return page.evaluate(
    async ({ svg, size, b64 }) => {
      const draw = async (src: string) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, size, size);
        return { data: ctx.getImageData(0, 0, size, size).data, w: img.naturalWidth };
      };
      const want = await draw(`data:image/svg+xml;base64,${btoa(svg)}`);
      const got = await draw(`data:image/png;base64,${b64}`);
      if (got.w !== size) return 255;
      let sum = 0;
      for (let i = 0; i < want.data.length; i++) sum += Math.abs(want.data[i]! - got.data[i]!);
      return sum / want.data.length;
    },
    { svg, size, b64: Buffer.from(png).toString("base64") },
  );
}

test("every icon file is our mark, pixel for pixel (none from the Next.js template)", async ({
  page,
}) => {
  await page.goto("/log-in");
  const checks = [
    ...PNG_ICONS.map((spec) => ({ spec, png: new Uint8Array(readFileSync(spec.file)) })),
    ...readIco(new Uint8Array(readFileSync(FAVICON_FILE))).map((frame) => {
      expect(frame.png, `${FAVICON_FILE} ${frame.size}px is a PNG frame`).toBe(true);
      return { spec: faviconSpec(frame.size), png: frame.data };
    }),
  ];
  expect(checks.length).toBe(PNG_ICONS.length + FAVICON_SIZES.length);
  for (const { spec, png } of checks) {
    const d = await distance(page, iconSvg(spec.shape, spec.heart, spec.size), spec.size, png);
    expect(d, `${spec.file} differs from the mark by ${d.toFixed(2)}`).toBeLessThan(2);
  }
});

test("the site serves our tab icon, favicon and Apple touch icon", async ({ page, request }) => {
  await page.goto("/");
  const links = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLLinkElement>("link[rel~=icon], link[rel=apple-touch-icon]"),
    ].map((l) => ({ rel: l.rel, href: new URL(l.href).pathname, type: l.type })),
  );
  expect(links).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ rel: "icon", href: "/icon.svg", type: "image/svg+xml" }),
      expect.objectContaining({ rel: "icon", href: "/favicon.ico" }),
      expect.objectContaining({ rel: "apple-touch-icon", href: "/apple-touch-icon.png" }),
    ]),
  );
  const svg = await (await request.get("/icon.svg")).text();
  expect(svg).toBe(readFileSync(ICON_SVG_FILE, "utf8"));
  const ico = await (await request.get("/favicon.ico")).body();
  expect(Buffer.compare(ico, readFileSync(FAVICON_FILE))).toBe(0);
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
      expect(
        Math.abs(s!.x + s!.width / 2 - (h!.x + h!.width / 2)),
        `${where} x`,
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(s!.y + s!.height / 2 - (h!.y + h!.height / 2)),
        `${where} y`,
      ).toBeLessThanOrEqual(0.5);
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
    const search = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const { messages = [] } = (await search.json()) as { messages?: { ID: string }[] };
    if (messages[0]) {
      html = (
        (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as {
          HTML: string;
        }
      ).HTML;
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
  expect(
    await page
      .locator("img[alt='']")
      .first()
      .evaluate((i: HTMLImageElement) => i.naturalWidth),
  ).toBe(56);
});
