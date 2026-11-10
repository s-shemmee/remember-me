import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Shared e2e helpers. Runs against local Supabase; emails land in Mailpit. */

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
export const PASSWORD = "test_password_00000000";

/**
 * Runs axe once the page has settled. Mid-animation, elements that fade in
 * (toasts, dialogs) have blended colours and fail color-contrast at random;
 * so wait for every finite animation and transition to finish first (Noor's
 * endless bob is ignored: it never finishes and changes no colours).
 */
export async function expectAccessible(page: Page, label: string) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity)
      .every((a) => a.playState !== "running"),
  );
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`),
    label,
  ).toEqual([]);
}

export async function confirmationLink(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const search = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const { messages = [] } = (await search.json()) as {
      messages?: { ID: string; Subject: string }[];
    };
    const message = messages.find((m) => m.Subject.includes("Confirm"));
    if (message) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json()) as {
        HTML: string;
      };
      const href = full.HTML.match(/href="([^"]*token_hash[^"]*)"/)?.[1];
      if (href) return href.replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No confirmation email for ${email} in Mailpit`);
}

/** A new, confirmed and onboarded account (no first person), signed in on `page`. */
export async function signUpAndOnboard(page: Page, firstName: string) {
  const email = `e2e.${firstName.toLowerCase()}.${Date.now()}@test.local`;
  await page.goto("/sign-up");
  await page.getByLabel("What should we call you?").fill(firstName);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/\/check-email$/);
  await page.goto(await confirmationLink(email));
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByRole("combobox", { name: "Day" }).selectOption("22");
  await page.getByRole("combobox", { name: "Month" }).selectOption("11");
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByRole("link", { name: "Take me home" }).click();
  await expect(page).toHaveURL(/\/home$/);
}
