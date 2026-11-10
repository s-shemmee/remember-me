import { expect, test } from "@playwright/test";

import { confirmationLink, expectAccessible, PASSWORD } from "./helpers";

/**
 * Sign up → confirm via Mailpit → onboarding (all four steps) → Home shows
 * the first person. Runs against local Supabase; emails never leave the box.
 * Every step is checked with axe (no serious or critical violations).
 */

test("sign up, confirm, onboard, and see your first person at home", async ({ page }) => {
  const email = `e2e.${Date.now()}@test.local`;

  // Sign up
  await page.goto("/sign-up");
  await page.getByLabel("What should we call you?").fill("Mira");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/\/check-email$/);

  // Confirm from Mailpit: lands on onboarding (not finished yet)
  await page.goto(await confirmationLink(email));
  await expect(page).toHaveURL(/\/onboarding$/);

  // 1 · You
  await expect(page.getByRole("heading", { level: 1, name: "First, you" })).toBeVisible();
  await expect(page.getByLabel("Your first name")).toHaveValue("Mira");
  await expectAccessible(page, "step 1");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Pick your birthday day and month to continue.")).toBeVisible();
  await page.getByRole("combobox", { name: "Day" }).selectOption("29");
  await page.getByRole("combobox", { name: "Month" }).selectOption("2");
  await page.getByRole("button", { name: "Continue" }).click();

  // 2 · Your look
  await expect(page.getByRole("heading", { level: 1, name: "Your look" })).toBeVisible();
  await page.getByRole("radio", { name: "Character" }).click();
  await page.getByRole("radio", { name: /Fox/ }).click();
  await page.getByRole("radio", { name: "Mint" }).click();
  await expectAccessible(page, "step 2");
  await page.getByRole("button", { name: "Continue" }).click();

  // 3 · First person
  await expect(page.getByRole("heading", { level: 1, name: "Your first person" })).toBeVisible();
  // Names stop at 40 characters and never push the page sideways.
  await page.getByLabel("Their name").fill("K".repeat(60));
  await expect(page.getByLabel("Their name")).toHaveValue("K".repeat(40));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("Their name").fill("Khalid");
  await page.getByRole("radio", { name: "Family" }).click();
  await page.getByRole("combobox", { name: "Day" }).selectOption("14");
  await page.getByRole("combobox", { name: "Month" }).selectOption("3");
  await page.getByLabel("A little thing they love (optional)").fill("black coffee");
  await expectAccessible(page, "step 3");
  await page.getByRole("button", { name: "Continue" }).click();

  // 4 · Reminders
  await expect(
    page.getByRole("heading", { level: 1, name: "When should I nudge you?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "2 weeks before" }).click();
  await expectAccessible(page, "step 4");
  await page.getByRole("button", { name: "Finish" }).click();

  // Done
  await expect(page.getByRole("heading", { level: 1, name: "You're all set, Mira" })).toBeVisible();
  await expect(
    page.getByText("Khalid is saved, and I'll nudge you before their day."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Take me home" }).click();

  // Home shows the person; onboarding is closed now
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 2, name: "Your people" })).toBeVisible();
  await expect(page.getByText("Khalid", { exact: true })).toBeVisible();
  await expect(page.getByText("Family · 14 March")).toBeVisible();
  await expect(
    page.locator("li", { hasText: "Khalid" }).locator("[data-slot='avatar']"),
  ).toHaveClass(/bg-sky/);
  await expectAccessible(page, "home");

  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/home$/);
});
