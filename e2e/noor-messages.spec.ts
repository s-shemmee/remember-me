import { expect, type Page, test } from "@playwright/test";

import { expectAccessible, signUpAndOnboard } from "./helpers";

/**
 * Noor drafts a message (AI phase 2), with AI_ENABLED, AI_MESSAGES_ENABLED
 * and AI_MOCK=1 on the server (CI sets all three; the mock never calls a real
 * provider): from a person's page, pick a tone, language and length, get 3
 * drafts, edit one, Copy, and "Use in plan" (saved on the Message step, which
 * is ticked); then from the plan's Message step itself. axe at 1440 and 390.
 */
test.skip(process.env.AI_MOCK !== "1", "needs a server started with AI_MOCK=1 and the flags on");

/** A day and month `n` days from today (UTC; far enough from midnight to be safe). */
function inDays(n: number) {
  const d = new Date(Date.now() + n * 86_400_000);
  return { day: String(d.getUTCDate()), month: String(d.getUTCMonth() + 1) };
}

async function addKhalid(page: Page) {
  await page.goto("/people");
  await page.getByRole("button", { name: "Add someone" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add someone" });
  await dialog.getByLabel("Their name").fill("Khalid");
  const soon = inDays(10);
  const bday = dialog.getByRole("group", { name: "Their birthday" });
  await bday.getByRole("combobox", { name: "Day" }).selectOption(soon.day);
  await bday.getByRole("combobox", { name: "Month" }).selectOption(soon.month);
  await dialog.getByLabel("Little things they love (optional)").fill("Black coffee");
  await dialog.getByLabel("Little things they love (optional)").press("Enter");
  await dialog.getByRole("button", { name: "Add Khalid" }).click();
  await expect(dialog).toBeHidden();
}

for (const width of [1440, 390]) {
  test(`draft, edit, copy and use in the plan (${width}px)`, async ({ page, context }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    await signUpAndOnboard(page, width > 500 ? "Rania" : "Samira");
    await addKhalid(page);
    // Adding someone opens their page (on phones too); else pick them from the list.
    const panel = page.getByRole("region", { name: "Khalid" });
    const card = page.getByRole("link", { name: /^Khalid/ });
    await expect(panel.or(card).first()).toBeVisible();
    if (!(await panel.isVisible())) await card.click();
    await expect(panel).toBeVisible();

    await panel.getByRole("button", { name: "Write a message" }).click();
    const sheet = page.getByRole("dialog", { name: "A message for Khalid" });
    await expect(sheet.getByRole("radio", { name: "Warm" })).toBeChecked();
    // Their little things are offered, all on; nothing else about them is.
    await expect(sheet.getByRole("button", { name: /Black coffee/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await sheet.getByRole("radio", { name: "Short and sweet" }).click();
    await sheet.getByRole("radio", { name: "French" }).click();
    await sheet.getByLabel("Something to mention (optional)").fill("notre voyage à Essaouira");
    await sheet.getByRole("button", { name: "Write with Noor" }).click();

    const drafts = sheet.getByRole("list", { name: "Drafts" }).getByRole("listitem");
    await expect(drafts).toHaveCount(3);
    await expect(sheet.getByLabel("Draft 1", { exact: true })).toHaveValue(/Joyeux anniversaire/);
    await expect(sheet.getByRole("status")).toHaveText(/3 drafts for Khalid/);
    await expect(sheet.getByRole("button", { name: "New drafts" })).toBeVisible();
    await expectAccessible(page, `message drafts, ${width}`);

    // Copy.
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(page.url()).origin,
    });
    await sheet.getByRole("button", { name: "Copy: draft 1" }).click();
    await expect(sheet.getByRole("button", { name: "Copied: draft 1" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
      /Joyeux anniversaire/,
    );

    // Edit, then use it: saved on the Message step, ticked.
    await sheet
      .getByLabel("Draft 2", { exact: true })
      .fill("Joyeux anniversaire Khalid, à très vite !");
    await sheet.getByRole("button", { name: "Use in plan: draft 2" }).click();
    await expect(sheet).toBeHidden();

    await panel.getByRole("button", { name: "Plan their day" }).click();
    const plan = page.getByRole("dialog", { name: /Khalid's birthday plan/ });
    const message = plan.getByRole("checkbox", { name: /^Message/ });
    await expect(message).toHaveAttribute("aria-checked", "true");
    await expect(plan.getByText("“Joyeux anniversaire Khalid, à très vite !”")).toBeVisible();

    // From the plan's Message step: another draft, in Darija this time.
    await plan.getByRole("button", { name: "Write another with Noor" }).click();
    const again = page.getByRole("dialog", { name: "A message for Khalid" });
    await again.getByRole("radio", { name: "Darija (Latin letters)" }).click();
    await again.getByRole("button", { name: "Write with Noor" }).click();
    await expect(again.getByLabel("Draft 1", { exact: true })).toHaveValue(/3id milad sa3id/);
    await again.getByRole("button", { name: "Use in plan: draft 1" }).click();
    await expect(again).toBeHidden();
    await expect(plan.getByText(/3id milad sa3id/)).toBeVisible();

    // Still there after a reload.
    await page.reload();
    await page
      .getByRole("region", { name: "Khalid" })
      .getByRole("button", { name: "Plan their day" })
      .click();
    await expect(
      page.getByRole("dialog", { name: /Khalid's birthday plan/ }).getByText(/3id milad sa3id/),
    ).toBeVisible();
  });
}
