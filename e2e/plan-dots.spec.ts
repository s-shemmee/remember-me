import { expect, type Page, test } from "@playwright/test";

import { signUpAndOnboard } from "./helpers";

/**
 * The plan's ticks and Home's "Coming up" dots read the same steps. Repro of
 * the bug: Gift, Message, Call and Cake ticked on Home's plan card, then a
 * Noor message "Use in plan": that used to add a second Message step (the
 * first was ticked), and the dots, scaled to 5 over 6 steps, showed 3.
 * Needs AI_MOCK=1 and AI_MESSAGES_ENABLED (CI sets both); works with the
 * Noor chat on (CI) or off (the message sheet).
 */
test.skip(
  process.env.AI_MOCK !== "1" || process.env.AI_MESSAGES_ENABLED !== "true",
  "needs AI_MOCK=1 and AI_MESSAGES_ENABLED=true",
);

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

test("4 ticked steps are 4 filled dots, also after a Noor message is used in the plan", async ({
  page,
}) => {
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

  // A Noor message, used in the plan while Message is already ticked.
  await page.goto("/people");
  const panel = page.getByRole("region", { name: "Khalid" });
  await panel.getByRole("button", { name: "Write a message" }).click();
  if (process.env.NOOR_CHAT_ENABLED === "true") {
    const chat = page.getByRole("dialog", { name: "Noor" });
    await chat.getByRole("button", { name: "Warm" }).click();
    await chat.getByRole("button", { name: "English" }).click();
    await chat.getByRole("button", { name: "Use in plan: draft 1" }).click();
    await expect(chat.getByRole("button", { name: "In the plan: draft 1" })).toBeVisible();
    await chat.getByRole("button", { name: "Close" }).click();
  } else {
    const sheet = page.getByRole("dialog", { name: "A message for Khalid" });
    await sheet.getByRole("button", { name: "Write with Noor" }).click();
    await sheet.getByRole("button", { name: "Use in plan: draft 1" }).click();
    await expect(sheet).toBeHidden();
  }

  // Still one Message step (now with the message), and still 4 of 5.
  await page.goto("/home");
  await expect(dots).toHaveAccessibleName("Plan 4 of 5 done");
  await expect(filledDots(page)).toHaveCount(4);
  await card.getByRole("button", { name: "Plan their day" }).click();
  const sheet = page.getByRole("dialog", { name: "Khalid's birthday plan" });
  await expect(sheet.getByRole("checkbox", { name: /^Message/ })).toHaveCount(1);
  await expect(sheet.getByRole("checkbox", { checked: true })).toHaveCount(4);
});
