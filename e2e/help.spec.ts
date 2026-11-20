import { expect, test } from "@playwright/test";

import { expectAccessible } from "./helpers";

/**
 * The public help center: /help lists the 8 articles, each article renders
 * from docs/help/*.md with its sections and links, unknown articles are 404,
 * and it's in the sitemap. axe at 390px, light and dark.
 */
test("/help lists every article, and an article renders with its sections", async ({ page }) => {
  await page.goto("/help");
  await expect(page.getByRole("heading", { level: 1, name: /How can we\s+help\?/ })).toBeVisible();
  const cards = page.getByRole("main").getByRole("listitem");
  await expect(cards).toHaveCount(8);

  await page.getByRole("link", { name: /Reminders by email and push/ }).click();
  await expect(page).toHaveURL(/\/help\/reminders$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Reminders by email and push" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Push notifications" })).toBeVisible();
  await expect(page.locator("#push-notifications")).toBeVisible();
  await expect(page.getByRole("link", { name: "All help articles" })).toHaveAttribute(
    "href",
    "/help",
  );
  await expect(
    page.getByRole("link", { name: /^Next:|Wishlists and secret reservations/ }).first(),
  ).toBeVisible();
  // Description in the metadata, canonical to itself.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/help\/reminders$/);
});

test("an unknown article is a 404, and the help pages are in the sitemap", async ({
  page,
  request,
}) => {
  // A slug never requested before: a real 404 from the very first request.
  const res = await page.goto(`/help/not-an-article-${Date.now()}`);
  expect(res?.status()).toBe(404);
  await expect(page.getByText(/could not be found/i)).toBeVisible();
  const trailing = await request.get("/help/getting-started/");
  expect(trailing.status()).toBeLessThan(400);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toMatch(/<loc>[^<]*\/help<\/loc>/);
  expect(sitemap).toMatch(/<loc>[^<]*\/help\/getting-started<\/loc>/);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).not.toMatch(/Disallow: \/help/);
});

test("the landing footer links to help", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Footer" })
    .getByRole("link", { name: "Help" })
    .click();
  await expect(page).toHaveURL(/\/help$/);
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: help pages at 390, ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript((t) => localStorage.setItem("rm-theme", t), theme);
    await page.setViewportSize({ width: 390, height: 900 });
    for (const path of ["/help", "/help/wishlists-and-reservations"]) {
      await page.goto(path);
      await expectAccessible(page, `${path} ${theme}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        390,
      );
    }
  });
}
