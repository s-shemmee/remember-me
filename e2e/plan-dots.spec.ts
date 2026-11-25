import { expect, type Page, test } from "@playwright/test";

import { signUpAndOnboard } from "./helpers";

function inDays(n: number) {
  const d = new Date(Date.now() + n * 86_400_000);
  return { day: String(d.getUTCDate()), month: String(d.getUTCMonth() + 1) };
}

/** The filled dots on a person's "Coming up" row. */
const filledDots = (page: Page) =>
  page
    .getByRole("region", { name: "Coming up" })
    .getByRole("img", { name: /^Plan/ })
    .locator("span[class*='-ink']");

test("the plan dots match the checklist as steps are ticked and unticked", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "Dounia");
  await page.goto("/people");
  await page.getByRole("button", { name: "Add someone" }).first().click();
  const add = page.getByRole("dialog", { name: "Add someone" });
  await add.getByLabel("Their name").fill("Khalid");
  const soon = inDays(4);
  const bday = add.getByRole("group", { name: "Their birthday" });
  await bday.getByRole("combobox", { name: "Day" }).selectOption(soon.day);
  await bday.getByRole("combobox", { name: "Month" }).selectOption(soon.month);
  await add.getByRole("button", { name: "Add Khalid" }).click();
  await expect(add).toBeHidden();

  // Home: tick the four steps on the plan card.
  await page.goto("/home");
  const card = page.getByRole("region", { name: "Khalid's birthday plan" });
  for (const step of ["Gift", "Message", "Call", "Cake"]) {
    await card.getByRole("button", { name: step, pressed: false }).click();
    await expect(card.getByRole("button", { name: step, pressed: true })).toBeVisible();
  }
  const dots = page.getByRole("region", { name: "Coming up" }).getByRole("img", { name: /^Plan/ });
  await expect(dots).toHaveAccessibleName("Plan 4 of 5 done");
  await expect(filledDots(page)).toHaveCount(4);

  await card.getByRole("button", { name: "Message", pressed: true }).click();
  await expect(card.getByRole("button", { name: "Message", pressed: false })).toBeVisible();
  await expect(dots).toHaveAccessibleName("Plan 3 of 5 done");
  await expect(filledDots(page)).toHaveCount(3);

  await card.getByRole("button", { name: "Plan their day" }).click();
  const sheet = page.getByRole("dialog", { name: "Khalid's birthday plan" });
  await expect(sheet.getByRole("checkbox", { name: /^Message/ })).toHaveCount(1);
  await expect(sheet.getByRole("checkbox", { checked: true })).toHaveCount(3);
});
