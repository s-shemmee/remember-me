import { expect, test } from "@playwright/test";

import { expectAccessible, signUpAndOnboard } from "./helpers";

/** Noor's help chat retrieves grounded answers from the local help content. */
test.skip(
  process.env.NOOR_CHAT_ENABLED !== "true" || process.env.AI_MOCK !== "1",
  "needs NOOR_CHAT_ENABLED=true and AI_MOCK=1",
);

test("opens from Home and Help & feedback with grounded answers", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "light" });
  await signUpAndOnboard(page, "Imane");
  await page.goto("/home");

  const nudge = page.getByRole("region", { name: "Noor" });
  await expect(nudge.getByRole("button", { name: "Ask Noor" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Noor" })).toHaveCount(0);
  await nudge.getByRole("button", { name: "Ask Noor" }).click();

  let chat = page.getByRole("dialog", { name: "Noor" });
  await expect(chat).toBeVisible();
  await expect(chat.getByRole("textbox", { name: "Ask Noor" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await chat.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  await chat.getByRole("button", { name: "How do reminders work?" }).click();
  await expect(chat.getByText(/Reminders arrive at 9:00 in the morning/)).toBeVisible();
  await expect(
    chat.getByRole("link", { name: /From: Reminders by email and push/ }),
  ).toHaveAttribute("href", "/help/reminders#choose-when");
  await expectAccessible(page, "Noor chat, desktop, light");
  await page.screenshot({ path: testInfo.outputPath("noor-chat-desktop-light.png") });
  await chat.getByRole("button", { name: "Close" }).click();
  await expect(chat).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/help-and-feedback");
  await page.getByLabel("Ask me anything about Remember Me.").fill("How do invites work?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  chat = page.getByRole("dialog", { name: "Noor" });
  // Your question in the thread (the same words may also be a suggestion chip).
  await expect(
    chat.getByRole("log", { name: "Conversation with Noor" }).getByText("How do invites work?"),
  ).toBeVisible();
  await expect(chat.getByText(/Reminders arrive at 9:00 in the morning/)).toBeVisible();
  await expectAccessible(page, "Noor chat from Help & feedback, phone, light");

  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(() => window.localStorage.setItem("rm-theme", "dark"));
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByLabel("Ask me anything about Remember Me.").fill("How do invites work?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  chat = page.getByRole("dialog", { name: "Noor" });
  await expect(chat.getByText(/Reminders arrive at 9:00 in the morning/)).toBeVisible();
  await expectAccessible(page, "Noor chat, phone, dark");
  await page.screenshot({ path: testInfo.outputPath("noor-chat-phone-dark.png") });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expectAccessible(page, "Noor chat, desktop, dark");
  await page.screenshot({ path: testInfo.outputPath("noor-chat-desktop-dark.png") });
  await page.setViewportSize({ width: 320, height: 800 });
  await expectAccessible(page, "Noor chat, 320px, dark");
  const horizontalOverflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    elements: Array.from(document.querySelectorAll("body *"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > window.innerWidth + 1 || element.scrollWidth > element.clientWidth + 1;
      })
      .slice(0, 10)
      .map((element) => ({
        tag: element.tagName,
        className: typeof element.className === "string" ? element.className : "",
        width: Math.round(element.getBoundingClientRect().width),
        right: Math.round(element.getBoundingClientRect().right),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      })),
  }));
  expect(horizontalOverflow.scrollWidth, JSON.stringify(horizontalOverflow)).toBeLessThanOrEqual(
    horizontalOverflow.clientWidth,
  );
});
