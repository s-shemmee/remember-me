import { expect, type Page, test } from "@playwright/test";

import { expectAccessible, signUpAndOnboard } from "./helpers";

/**
 * Noor's gift ideas (AI phase 1), with AI_GIFT_IDEAS_ENABLED=true and
 * AI_MOCK=1 on the server (CI sets both; the mock never calls a provider).
 * From Home's nudge: pick a budget, get ideas, "Add to their plan" renames
 * the unticked Gift step (never ticked, never a second one). On the person's
 * panel the button is there, and "In memory" hides it. axe at 390px.
 */
test.skip(
  process.env.AI_MOCK !== "1" ||
    process.env.AI_GIFT_IDEAS_ENABLED !== "true" ||
    process.env.NOOR_CHAT_ENABLED === "true",
  "needs AI_GIFT_IDEAS_ENABLED=true AI_MOCK=1 with the Noor chat flag off",
);

test.use({ timezoneId: "Europe/London" });

function soon(days: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "numeric",
  }).formatToParts(new Date(Date.now() + days * 86_400_000));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { day: get("day"), month: get("month") };
}

async function addPerson(page: Page, name: string, when: { day: string; month: string }) {
  await page.goto("/people");
  await page.getByRole("button", { name: "Add someone" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add someone" });
  await dialog.getByLabel("Their name").fill(name);
  const bday = dialog.getByRole("group", { name: "Their birthday" });
  await bday.getByRole("combobox", { name: "Day" }).selectOption(when.day);
  await bday.getByRole("combobox", { name: "Month" }).selectOption(when.month);
  await dialog.getByRole("button", { name: `Add ${name}` }).click();
  await expect(dialog).toBeHidden();
}

test("gift ideas from Home, added to their plan", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 900 });
  await signUpAndOnboard(page, "Imane");
  await addPerson(page, "Khalid", soon(3));

  await page.goto("/home");
  await page
    .getByRole("region", { name: "Noor" })
    .getByRole("button", { name: /Ask Noor for gift ideas/ })
    .click();
  const sheet = page.getByRole("dialog", { name: "Gift ideas for Khalid" });
  await expect(sheet.getByText(/suggest a few ideas based on what Khalid loves/)).toBeVisible();

  // Budget chips are toggles.
  const budget = sheet.getByRole("group", { name: "Budget (optional)" });
  await budget.getByRole("button", { name: "Small" }).click();
  await expect(budget.getByRole("button", { name: "Small" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(budget.getByRole("button", { name: "Treat" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await sheet.getByRole("button", { name: "Show me ideas" }).click();
  await expect(sheet.getByText("Here are 3 ideas for Khalid.")).toBeVisible();
  await expect(sheet.getByRole("listitem")).toHaveCount(3);
  await expect(sheet.getByRole("button", { name: "New ideas" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Copy: / })).toHaveCount(3);
  await expectAccessible(page, "gift ideas sheet");

  await sheet.getByRole("button", { name: "Add to their plan" }).first().click();
  await expect(sheet.getByText('Added "A cosy tea tasting set" to their plan.')).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Added to their plan/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // The plan's Gift step now is the idea, unticked; there's no second gift step.
  const card = page.getByRole("region", { name: "Khalid's birthday plan" });
  await expect(
    card.getByRole("button", { name: "A cosy tea tasting set", pressed: false }),
  ).toBeVisible();
  await expect(card.getByRole("button", { name: "Gift" })).toHaveCount(0);

  // Still there after a reload (it was saved, not just shown).
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Khalid's birthday plan" })
      .getByRole("button", { name: "A cosy tea tasting set", pressed: false }),
  ).toBeVisible();
});

test("on the person's panel, and hidden for someone In memory", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 900 });
  await signUpAndOnboard(page, "Rim");
  await addPerson(page, "Sara", soon(20));

  // Adding someone opens their panel.
  const profile = page.getByRole("region", { name: "Sara" });
  const ask = profile.getByRole("button", { name: "Gift ideas", exact: true });
  await expect(ask).toBeVisible();

  await profile.getByRole("switch", { name: "In memory" }).click();
  await expect(profile.getByText("In memory. No gift ideas here.")).toBeVisible();
  await expect(ask).toHaveCount(0);
});
