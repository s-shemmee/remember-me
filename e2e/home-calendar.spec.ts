import { expect, test } from "@playwright/test";

import { expectAccessible, signUpAndOnboard } from "./helpers";

/** A date `n` days from now, in the browser's timezone (onboarding saved the same one). */
function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return {
    day: d.getDate(),
    month: d.getMonth() + 1,
    sameMonth: d.getMonth() === new Date().getMonth(),
  };
}

/**
 * Home and Calendar (M2 part 2): add a person whose birthday is in 3 days,
 * then see them on Home (Noor, Next up, Coming up, mini month) and in
 * Calendar (their day, its details, Next 30 days). axe on both pages.
 */
test("add a person and see them on Home and in Calendar", async ({ page }) => {
  await signUpAndOnboard(page, "Rania");

  // Empty Home first: Noor invites you to add someone.
  await expect(page.getByText(/Add the first person you'd hate to forget/)).toBeVisible();
  await expectAccessible(page, "home, empty");

  const bday = inDays(3);
  await page.getByRole("button", { name: "Add someone" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add someone" });
  await dialog.getByLabel("Their name").fill("Karim");
  await dialog.getByRole("radio", { name: "Friend", exact: true }).click();
  const birthday = dialog.getByRole("group", { name: "Their birthday" });
  await birthday.getByRole("combobox", { name: "Day" }).selectOption(String(bday.day));
  await birthday.getByRole("combobox", { name: "Month" }).selectOption(String(bday.month));
  await dialog.getByLabel("Little things they love (optional)").fill("mint tea");
  await dialog.getByRole("button", { name: "Add Karim" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Karim added")).toBeVisible();

  // Home: Noor (no birth year, so no "turns N"), Next up, Coming up, mini month.
  await expect(
    page.getByText("It's Karim's birthday in 3 days 🎂 Little thing: mint tea"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Karim" })).toHaveAttribute(
    "href",
    /\/people\?person=/,
  );
  const glance = page.getByRole("list", { name: "At a glance" });
  await expect(glance.getByText("Karim")).toBeVisible();
  await expect(glance.getByText("birthday in 3 days")).toBeVisible();
  const comingUp = page.getByRole("region", { name: "Coming up" });
  await expect(comingUp.getByRole("link", { name: /Karim/ })).toContainText("in 3 days");
  if (bday.sameMonth) {
    await expect(page.getByRole("table").getByText(": Karim's birthday")).toBeAttached();
  }
  await expectAccessible(page, "home, with Karim");

  // Calendar: Karim's day, its details, and the next 30 days.
  await page
    .getByRole("navigation", { name: "Main" })
    .filter({ visible: true })
    .getByRole("link", { name: "Calendar" })
    .click();
  await expect(page).toHaveURL(/\/calendar$/);
  const next30 = page.getByRole("region", { name: "Next 30 days" });
  await next30.getByRole("button", { name: /Karim's birthday/ }).click();
  const cell = page.getByRole("gridcell", { name: /Karim's birthday/ });
  await expect(cell).toHaveAttribute("aria-selected", "true");
  await expect(
    page.locator("[aria-labelledby='calendar-day']").getByText("Karim's birthday"),
  ).toBeVisible();

  // Keyboard: arrows move the selection between days.
  await cell.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("gridcell", { selected: true })).not.toHaveAccessibleName(/Karim/);
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("gridcell", { name: /Karim's birthday/ })).toBeFocused();
  await expectAccessible(page, "calendar");
});
