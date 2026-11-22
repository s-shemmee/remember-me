import { expect, type Page, test } from "@playwright/test";

import { expectAccessible, signUpAndOnboard } from "./helpers";

/**
 * feat/people-parity-likes-emoji: an emoji per little thing (suggested
 * while typing, picked from the full picker by mouse or keyboard, reset to
 * the heart), shown on the profile; choosing people on desktop;
 * opening one on a phone and going back.
 */
async function addPerson(page: Page, name: string, things: string[] = []) {
  await page.getByRole("button", { name: "Add someone" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add someone" });
  await dialog.getByLabel("Their name").fill(name);
  const bday = dialog.getByRole("group", { name: "Their birthday" });
  await bday.getByRole("combobox", { name: "Day" }).selectOption("9");
  await bday.getByRole("combobox", { name: "Month" }).selectOption("9");
  for (const t of things) {
    await dialog.getByLabel("Little things they love (optional)").fill(t);
    await dialog.getByLabel("Little things they love (optional)").press("Enter");
  }
  return dialog;
}

for (const theme of ["light", "dark"] as const) {
  test(`little things: suggest, pick, type your own, reset, keyboard (${theme})`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript((t) => localStorage.setItem("rm-theme", t), theme);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signUpAndOnboard(page, theme === "light" ? "Lina" : "Malak");
    await page.goto("/people");

    const dialog = await addPerson(page, "Khalid");
    const field = dialog.getByLabel("Little things they love (optional)");

    // Suggested while typing: coffee → ☕.
    await field.fill("black coffee");
    const draft = dialog.getByRole("button", { name: "Choose an emoji for black coffee" });
    await expect(draft).toHaveText("☕");

    // A hand-picked emoji is never replaced by a suggestion. The picker opens
    // on its search field; picking closes it and focus goes back.
    await draft.click();
    const picker = page.getByRole("dialog", { name: "Emoji for black coffee" });
    const search = picker.getByLabel("Search emoji");
    await expect(search).toBeFocused();
    await expect(picker.getByRole("button", { name: /^Change skin tone/ })).toBeVisible();
    await expect(
      picker.getByRole("gridcell", { name: "Grinning face", exact: true }),
    ).toBeVisible();
    await expectAccessible(page, `emoji picker open, ${theme}`);
    await search.fill("shortcake");
    await picker.getByRole("gridcell", { name: "Shortcake" }).click();
    await expect(picker).toBeHidden();
    await expect(draft).toBeFocused();
    await field.fill("black coffee and tea");
    await expect(
      dialog.getByRole("button", { name: "Choose an emoji for black coffee and tea" }),
    ).toHaveText("🍰");
    await field.press("Enter");

    // Another one, then change its emoji by keyboard: search, arrows, Enter.
    await field.fill("Loves football");
    await field.press("Enter");
    const football = dialog.getByRole("button", { name: "Choose an emoji for Loves football" });
    await expect(football).toHaveText("⚽");
    await football.click();
    const footballPicker = page.getByRole("dialog", { name: "Emoji for Loves football" });
    await footballPicker.getByLabel("Search emoji").fill("basketball");
    await expect(footballPicker.getByRole("gridcell", { name: "Basketball" })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(football).toHaveText("🏀");

    // Escape closes and returns focus.
    await football.click();
    await page.keyboard.press("Escape");
    await expect(footballPicker).toBeHidden();
    await expect(football).toBeFocused();

    // Back to the heart.
    await football.click();
    await page.getByRole("button", { name: "Reset to heart" }).click();
    await expect(football).toHaveText("❤️");

    await dialog.getByRole("button", { name: "Add Khalid" }).click();
    await expect(dialog).toBeHidden();

    // The profile shows them with their emoji.
    const panel = page.getByRole("region", { name: "Khalid" });
    const things = panel.getByRole("list", { name: "Little things" });
    await expect(things.getByRole("listitem")).toHaveText([
      "🍰black coffee and tea",
      "❤️Loves football",
    ]);
    await expect(panel.getByText("Not connected yet, so no shared wishlist.")).toBeVisible();
    await expect(panel.getByRole("button", { name: /^Invite them.*Khalid/ })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Plan their day" })).toBeVisible();
    await expectAccessible(page, `people with a profile, ${theme}`);

    // Saved: still there after a reload.
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Khalid" }).getByRole("list", { name: "Little things" }),
    ).toContainText("🍰black coffee and tea");
  });
}

test("desktop: choosing a person shows their profile next to the list; phone: open and back", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUpAndOnboard(page, "Nour");
  await page.goto("/people");
  for (const name of ["Omar", "Yasmine"]) {
    const dialog = await addPerson(page, name);
    await dialog.getByRole("button", { name: `Add ${name}` }).click();
    await expect(dialog).toBeHidden();
    // Adding opens them; let that settle before choosing someone else.
    await expect(page.getByRole("region", { name })).toBeVisible();
  }

  await page.getByRole("link", { name: /^Omar/ }).click();
  await expect(page.getByRole("region", { name: "Omar" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Omar/ })).toHaveAttribute("aria-current", "true");
  await page.getByRole("link", { name: /^Yasmine/ }).click();
  await expect(page.getByRole("region", { name: "Yasmine" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Yasmine/ })).toHaveAttribute(
    "aria-current",
    "true",
  );
  // Both side by side on desktop.
  await expect(page.getByRole("region", { name: "Your people" })).toBeVisible();

  // Phone: the list only; a person opens on their own, with a way back.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/people");
  await expect(page.getByRole("region", { name: "Your people" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Omar" })).toBeHidden();
  await page.getByRole("link", { name: /^Omar/ }).click();
  const omar = page.getByRole("region", { name: "Omar" });
  await expect(omar).toBeVisible();
  await expect(page.getByRole("region", { name: "Your people" })).toBeHidden();
  await expect(omar.getByRole("heading", { name: "Days to remember" })).toBeVisible();
  await expectAccessible(page, "person on a phone");
  await omar.getByRole("button", { name: "All people" }).click();
  await expect(page.getByRole("region", { name: "Your people" })).toBeVisible();
});
