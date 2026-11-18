import { expect, test } from "@playwright/test";

import { expectAccessible, signUpAndOnboard } from "./helpers";

/**
 * M6 part 1: the landing page. Renders every section, the CTAs go to
 * sign-up, signed-in visitors go straight home, the SEO files are served,
 * the structured data parses, there's no layout shift, and axe passes at 390
 * and 1440 in light and dark.
 */

test("the landing page: every section, CTAs to sign-up, FAQ by keyboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Remember Me · Never forget the people you love");
  // One static sentence for screen readers; the moving words are decorative.
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Never forget your best friend's, mom & dad's, little sister's or own special day.",
    }),
  ).toBeVisible();
  for (const name of [
    /Everything you need to show up for them/,
    /How it works/,
    /Say hi to Noor/,
    /Questions, answered/,
    /Someone's day is coming up/,
  ]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  // Real content only.
  await expect(page.locator("main")).not.toContainText(/testimonial|users love|★/i);

  // The CTAs.
  const ctas = page.getByRole("link", { name: "Start remembering" });
  await expect(ctas).toHaveCount(2);
  for (const href of await ctas.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) {
    expect(href).toBe("/sign-up");
  }
  await ctas.first().click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await page.goBack();
  await page.getByRole("link", { name: /^Sign up/ }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await page.goBack();

  // FAQ: native details, open and close with the keyboard.
  const question = page.getByText("Will my friend know I reserved their gift?");
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Never\. Reservations are hidden/)).toBeVisible();

  // The example plan can be ticked (nothing is saved).
  const call = page.getByRole("button", { name: "Call", pressed: false });
  await call.click();
  await expect(page.getByRole("button", { name: "Call", pressed: true })).toBeVisible();

  // Footer links.
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  await expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  await expect(footer.getByRole("link", { name: "Contact" })).toHaveAttribute(
    "href",
    "mailto:contact@shemme.codes",
  );
});

test("SEO: canonical, Open Graph, JSON-LD, robots.txt, sitemap.xml and the OG image", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /^https?:\/\/[^/]+\/?$/,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Remember Me · Never forget the people you love",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(ogImage).toMatch(/\/opengraph-image/);
  const image = await request.get(new URL(ogImage!).pathname + new URL(ogImage!).search);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");

  const ld = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? "")));
  expect(ld.map((d) => d["@type"]).sort()).toEqual(["FAQPage", "WebApplication"]);
  const faq = ld.find((d) => d["@type"] === "FAQPage");
  const visible = await page.locator("#faq summary").allTextContents();
  expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(visible.map((t) => t.trim()));

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Allow: /");
  expect(robots).toContain("Disallow: /home");
  expect(robots).toContain("Disallow: /settings");
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>");

  // Private pages say noindex.
  await page.goto("/log-in");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("no layout shift while the page loads", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(5500); // the hero words finish moving
  const cls = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!e.hadRecentInput) total += e.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(total), 300);
      }),
  );
  expect(cls).toBeLessThan(0.05);
});

for (const scheme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`axe at ${width}px, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectAccessible(page, `landing ${width} ${scheme}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "no horizontal scroll").toBe(0);
    });
  }
}

test("signed-in visitors go straight to /home", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "Maya");
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
});
