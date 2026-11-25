import { expect, test } from "@playwright/test";

import { expectAccessible, signUpAndOnboard } from "./helpers";

/**
 * Ask Noor uses retrieved help content and scripted answers in this test
 * (CI sets both; the mock never calls a real provider). Ask through a
 * suggested question, see the answer and its source link to the help center;
 * an off-topic question gets Noor's fixed reply; axe at 390px.
 */
test.skip(
  process.env.AI_MOCK !== "1" || process.env.NOOR_CHAT_ENABLED === "true",
  "needs AI_MOCK=1 with the Noor chat flag off",
);

test("ask a question and see the answer with its source", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 900 });
  await signUpAndOnboard(page, "Hiba");

  // The account menu leads to Help & feedback.
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: /Help & feedback/ }).click();
  await expect(page).toHaveURL(/\/help$/);

  const card = page.locator("#ask-noor");
  await expect(card.getByRole("heading", { name: "Ask Noor" })).toBeVisible();
  await expect(
    card.getByRole("group", { name: "Suggested questions" }).getByRole("button"),
  ).toHaveCount(3);

  await card.getByRole("button", { name: "When do reminders arrive?" }).click();
  await expect(card.getByText("You asked: When do reminders arrive?")).toBeVisible();
  await expect(card.getByText(/9:00 in the morning/)).toBeVisible();
  const source = card.getByRole("link", { name: /Reminders by email and push/ });
  await expect(source).toHaveAttribute("href", "/help/reminders#choose-when");
  await expectAccessible(page, "ask noor, answer");

  // Off-topic: Noor's fixed reply, with the contact address as a link.
  const field = card.getByLabel("Your question");
  await field.fill("What's the capital of France?");
  await expect(card.getByText("29/300 characters")).toBeVisible();
  await field.press("Enter");
  await expect(card.getByText(/I can only help with Remember Me/)).toBeVisible();
  await expect(card.getByRole("link", { name: "contact@shemme.codes" })).toHaveAttribute(
    "href",
    "mailto:contact@shemme.codes",
  );

  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(() => localStorage.setItem("rm-theme", "dark"));
  await page.reload();
  await expect(page.locator("#ask-noor")).toBeVisible();
  await expectAccessible(page, "ask noor, dark");
});
