import { expect, type Page, test } from "@playwright/test";

import { signUpAndOnboard } from "./helpers";

/**
 * Theme: one source of truth.
 * - Signed-out pages and new accounts start in light, even on a dark system.
 * - The toggle sticks: toggle, navigate three times, refresh, still the same.
 */
test.use({ colorScheme: "dark" });

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

test("signed-out pages start in light on a dark system", async ({ page }) => {
  for (const path of ["/", "/log-in", "/sign-up"]) {
    await page.goto(path);
    expect(await isDark(page), path).toBe(false);
  }
});

test("a new account starts in light, and the toggle survives navigation and a refresh", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "Salma");
  expect(await isDark(page)).toBe(false);

  await page
    .getByRole("button", { name: "Switch to dark theme" })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  const nav = page.getByRole("complementary", { name: "App" });
  for (const [link, url] of [
    ["People", /\/people$/],
    ["Calendar", /\/calendar$/],
    ["Home", /\/home$/],
  ] as const) {
    await nav.getByRole("link", { name: link, exact: true }).click();
    await expect(page).toHaveURL(url);
    // Give a stale render every chance to flip it back.
    await page.waitForLoadState("networkidle");
    expect(await isDark(page), `after ${link}`).toBe(true);
  }

  await page.reload();
  await page.waitForLoadState("networkidle");
  expect(await isDark(page), "after refresh").toBe(true);

  // Settings → Appearance agrees.
  await page.goto("/settings");
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
});
