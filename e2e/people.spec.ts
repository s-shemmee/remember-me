import { expect, test } from "@playwright/test";

import { expectAccessible, signUpAndOnboard } from "./helpers";

/**
 * People (M2 part 1): add a person through the dialog and see them on the
 * People grid and in their profile, in their colour. Then remove them and
 * bring them back with Undo. axe runs on the page and the open dialog.
 */
test("add a person and see them in People", async ({ page }) => {
  await signUpAndOnboard(page, "Lina");

  // The shell: People in the sidebar (desktop project) leads to the page.
  await page
    .getByRole("navigation", { name: "Main" })
    .filter({ visible: true })
    .getByRole("link", { name: "People" })
    .click();
  await expect(page).toHaveURL(/\/people$/);
  await expect(page.getByRole("heading", { level: 1, name: "People" })).toBeVisible();
  await expect(page.getByText("Add the first person you'd hate to forget")).toBeVisible();
  await expectAccessible(page, "people, empty");

  // Add someone
  await page.getByRole("button", { name: "Add someone" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add someone" });
  await expect(dialog).toBeVisible();
  await expectAccessible(page, "add dialog");

  await dialog.getByLabel("Their name").fill("Yasmine");
  await dialog.getByRole("radio", { name: "Family" }).click();
  await dialog.getByLabel("How you'd describe them (optional)").fill("Little sister");
  const birthday = dialog.getByRole("group", { name: "Their birthday" });
  await birthday.getByRole("combobox", { name: "Day" }).selectOption("14");
  await birthday.getByRole("combobox", { name: "Month" }).selectOption("4");
  await birthday.getByLabel("Year (optional)").fill("2004");

  await dialog.getByRole("button", { name: "Add an anniversary or another day" }).click();
  await dialog.getByLabel("Kind of day").selectOption("graduation");
  const date = dialog.getByRole("group", { name: "Date" });
  await date.getByRole("combobox", { name: "Day" }).selectOption("24");
  await date.getByRole("combobox", { name: "Month" }).selectOption("6");

  const things = dialog.getByLabel("Little things they love (optional)");
  await things.fill("sunflowers");
  await things.press("Enter");
  await things.fill("watercolours");
  await things.press("Enter");
  await expect(
    dialog.getByRole("list", { name: "Their little things" }).getByRole("listitem"),
  ).toHaveCount(2);

  await dialog.getByRole("button", { name: "Add Yasmine" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Yasmine added")).toBeVisible();

  // On the grid, in Family's sky, with her next day; and in her profile.
  await expect(page.getByRole("main").getByText("1 person")).toBeVisible();
  await expect(page.getByRole("button", { name: /1 person , account menu/ })).toBeVisible();
  const card = page.getByRole("link", { name: /^Yasmine/ });
  await expect(card).toContainText("Little sister");
  await expect(card.locator("[data-slot='avatar']")).toHaveClass(/bg-sky/);
  const profile = page.getByRole("region", { name: "Yasmine" });
  await expect(profile.getByText(/^Birthday, turns \d+$/)).toBeVisible();
  await expect(profile.getByText("Graduation")).toBeVisible();
  await expect(profile.getByText("sunflowers")).toBeVisible();
  await expectAccessible(page, "people, with Yasmine");

  // Filters: Family shows her, Work doesn't.
  await page.getByRole("button", { name: "Work" }).click();
  await expect(
    page.getByText("No one here yet. Try another filter, or add someone."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Family" }).click();
  await expect(card).toBeVisible();

  // Still there after a reload (saved in the database).
  await page.reload();
  await expect(page.getByRole("link", { name: /^Yasmine/ })).toBeVisible();

  // Remove, then Undo.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Remove Yasmine?" })
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page.getByText("Yasmine removed")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Yasmine/ })).toBeHidden();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Yasmine is back")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Yasmine/ })).toBeVisible();
});
