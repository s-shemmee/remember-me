import { expect, test } from "@playwright/test";

import { expectAccessible, signUpAndOnboard } from "./helpers";

/** A date `n` days from now, in the browser's timezone (onboarding saved the same one). */
function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Occasion types: add a Work milestone from the "New job" chip (once) and a
 * Remembrance with a title. Home's Noor speaks gently about the remembrance;
 * Calendar shows the new job on its date, and not on the same date a year
 * later. axe on the dialog with chips.
 */
test("add a work milestone from a chip and see it once in Calendar", async ({ page }) => {
  await signUpAndOnboard(page, "Imane");
  const bday = inDays(100);
  const job = inDays(5);
  const memory = inDays(2);

  await page.getByRole("button", { name: "Add someone" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add someone" });
  await dialog.getByLabel("Their name").fill("Samir");
  const birthday = dialog.getByRole("group", { name: "Their birthday" });
  await birthday.getByRole("combobox", { name: "Day" }).selectOption(String(bday.day));
  await birthday.getByRole("combobox", { name: "Month" }).selectOption(String(bday.month));

  // Work milestone from the "New job" chip: fills the title, sets "Once".
  await dialog.getByRole("button", { name: "Add an anniversary or another day" }).click();
  await dialog.locator("#pf-day-0-kind").selectOption("work_milestone");
  await dialog
    .getByRole("group", { name: "Suggestions" })
    .getByRole("button", { name: "New job" })
    .click();
  await expect(dialog.locator("#pf-day-0-title")).toHaveValue("New job");
  await expect(dialog.locator("#pf-day-0-title")).toBeFocused();
  await expect(dialog.getByRole("radio", { name: "Once" })).toBeChecked();
  await dialog.locator("#pf-day-0-day").selectOption(String(job.day));
  await dialog.locator("#pf-day-0-month").selectOption(String(job.month));
  await dialog.locator("#pf-day-0-year").fill(String(job.year));
  await expectAccessible(page, "dialog with suggestion chips");

  // A Remembrance with a title, every year.
  await dialog.getByRole("button", { name: "Add another day" }).click();
  await dialog.locator("#pf-day-1-kind").selectOption("remembrance");
  await expect(dialog.locator("#pf-day-1-title")).toHaveAttribute("placeholder", "In memory of…");
  await dialog.locator("#pf-day-1-title").fill("In memory of Dad");
  await dialog.locator("#pf-day-1-day").selectOption(String(memory.day));
  await dialog.locator("#pf-day-1-month").selectOption(String(memory.month));

  await dialog.getByRole("button", { name: "Add Samir" }).click();
  await expect(dialog).toBeHidden();

  // Home: Noor is gentle about the remembrance (it's the soonest).
  await page.goto("/home");
  await expect(
    page.getByText("In 2 days: Samir · In memory of Dad 🕊️ A kind word can mean a lot."),
  ).toBeVisible();
  // Next up never shows a day of remembrance.
  await expect(
    page.getByRole("list", { name: "At a glance" }).getByText("new job in 5 days"),
  ).toBeVisible();

  // Calendar: the new job on its date…
  await page.goto("/calendar");
  await page
    .getByRole("region", { name: "Next 30 days" })
    .getByRole("button", { name: /Samir · New job/ })
    .click();
  await expect(page.getByRole("gridcell", { name: /Samir · New job/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // …and not on the same date a year later (it happens once).
  const next = `${job.year + 1}-${pad(job.month)}`;
  await page.goto(`/calendar?month=${next}&day=${next}-${pad(job.day)}`);
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(page.getByRole("gridcell", { name: /New job/ })).toHaveCount(0);
  // The remembrance repeats every year.
  const memNext = `${memory.year + 1}-${pad(memory.month)}`;
  await page.goto(`/calendar?month=${memNext}&day=${memNext}-${pad(memory.day)}`);
  await expect(page.getByRole("gridcell", { name: /Samir · In memory of Dad/ })).toBeVisible();
  await expectAccessible(page, "calendar next year");
});
