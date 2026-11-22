import { expect, type Page, test } from "@playwright/test";

import { expectAccessible, signUpAndOnboard } from "./helpers";

/**
 * fix/header-profile-settings: the one page header (order per page, desktop
 * and phone), the theme toggle and Settings → Appearance agreeing, Settings
 * only reachable from the account menu, Settings sections (deep link, phone
 * back button), and Help & feedback (send, the email to us, the daily limit).
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const BELL = process.env.NOTIFICATIONS_INBOX_ENABLED === "true";

/** The visible controls in the page header, in DOM order, by name. */
const headerControls = (page: Page) =>
  page.evaluate(() => {
    const header = Array.from(
      document.querySelectorAll<HTMLElement>("[data-slot=page-header]"),
    ).find((h) => h.checkVisibility());
    if (!header) return null;
    return Array.from(header.querySelectorAll<HTMLElement>("a, button, input"))
      .filter((el) => el.checkVisibility())
      .map(
        (el) =>
          el.getAttribute("aria-label") ??
          el.getAttribute("placeholder") ??
          el.textContent?.trim() ??
          "",
      );
  });

async function addPerson(page: Page, name: string) {
  await page.goto("/people");
  await page.getByRole("button", { name: "Add someone" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add someone" });
  await dialog.getByLabel("Their name").fill(name);
  const bday = dialog.getByRole("group", { name: "Their birthday" });
  await bday.getByRole("combobox", { name: "Day" }).selectOption("9");
  await bday.getByRole("combobox", { name: "Month" }).selectOption("9");
  await dialog.getByRole("button", { name: `Add ${name}` }).click();
  await expect(dialog).toBeHidden();
}

test("header order on every page: search, primary, theme, bell (desktop and phone)", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUpAndOnboard(page, "Hanae");
  await addPerson(page, "Khalid");

  const bell = BELL ? ["Notifications"] : [];
  const theme = "Switch to dark mode";
  const pages = (search: string) =>
    [
      ["/home", [search, "Add someone", ...bell]],
      ["/people", [search, "Add someone", theme, ...bell]],
      ["/calendar", ["Add someone", theme, ...bell]],
      ["/wishlists", ["Add a wish", theme, ...bell]],
      ["/celebrate", ["My wishlist", theme, ...bell]],
      ["/profile", [...bell]],
      ["/settings/reminders", [...bell]],
      ["/help", [...bell]],
    ] as const;

  for (const [path, expected] of pages("Search people…")) {
    await page.goto(path);
    await expect(page.locator("[data-slot=page-header]").first()).toBeVisible();
    expect(await headerControls(page), `${path} at 1440`).toEqual(expected);
  }
  if (!BELL) await expect(page.getByRole("link", { name: "Notifications" })).toHaveCount(0);

  // Phones: the same order, as 44px icon buttons.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, expected] of pages("Search people")) {
    if (path.startsWith("/settings")) continue; // phones show the section's own header
    await page.goto(path);
    await expect(page.locator("[data-slot=page-header]").first()).toBeVisible();
    expect(await headerControls(page), `${path} at 390`).toEqual(expected);
  }
  await page.goto("/people");
  for (const name of ["Search people", "Add someone", theme]) {
    const box = await page
      .locator("[data-slot=page-header]")
      .getByRole("button", { name })
      .boundingBox();
    expect(box?.width, name).toBeGreaterThanOrEqual(44);
    expect(box?.height, name).toBeGreaterThanOrEqual(44);
  }
  // The search button opens the field, focused.
  await page.getByRole("button", { name: "Search people" }).click();
  await expect(page.getByRole("searchbox", { name: "Search people" })).toBeFocused();
});

test("the theme toggle and Settings → Appearance are one setting", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUpAndOnboard(page, "Imane");
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await page.goto("/settings/appearance");
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
  await page.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);

  await page.goto("/wishlists");
  await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
});

test("Settings: only from the account menu, one section at a time, deep links and the phone back button", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUpAndOnboard(page, "Jamila");

  // The sidebar has no Settings link; the menu on your name is the way in.
  const sidebar = page.getByRole("complementary", { name: "App" });
  await expect(sidebar.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await page.getByRole("button", { name: /account menu/ }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText([
    "My profile",
    "Settings",
    "Help & feedback",
    "Log out",
  ]);
  await menu.getByRole("menuitem", { name: "Settings" }).click();
  // Desktop: /settings opens the first section.
  await expect(page).toHaveURL(/\/settings\/reminders$/, { timeout: 60_000 });
  const tabs = page.getByRole("navigation", { name: "Settings" });
  await expect(tabs.getByRole("link", { name: "Reminders" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByText("Saved automatically as you go")).toBeVisible();

  // A deep link opens that section, marked in the tab bar.
  await page.goto("/settings/privacy");
  await expect(tabs.getByRole("link", { name: "Privacy" })).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("switch", { name: /Show my birthday to my connections/ }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Download my data" })).toBeVisible();
  await expectAccessible(page, "settings privacy 1440");

  // Account ends with the danger card, then an outlined Log out.
  await page.goto("/settings/account");
  await expect(page.getByRole("heading", { name: "Delete my account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out", exact: true })).toBeVisible();

  // Phones: /settings is a list; each section has a back button.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  const list = page.getByRole("navigation", { name: "Settings sections" });
  await expect(list.getByRole("link")).toHaveCount(5);
  await expectAccessible(page, "settings list 390");
  await list.getByRole("link", { name: /Privacy/ }).click();
  await expect(page).toHaveURL(/\/settings\/privacy$/);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(list).toBeVisible();

  // The Me page (profile) has Settings and Help & feedback rows on phones.
  await page.goto("/profile");
  const more = page.getByRole("navigation", { name: "More" });
  await expect(more.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  await expect(more.getByRole("link", { name: "Help & feedback" })).toHaveAttribute(
    "href",
    "/help",
  );
});

test("Help & feedback: send, the email to us, and 5 a day", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndOnboard(page, "Karima");

  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Help & feedback" }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole("heading", { level: 1, name: "Help & feedback" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Browse help" }).getByRole("listitem")).toHaveCount(
    6,
  );
  await expect(page.getByRole("link", { name: "contact@shemme.codes" })).toHaveAttribute(
    "href",
    "mailto:contact@shemme.codes",
  );
  await expectAccessible(page, "help & feedback 390");

  const form = page.getByRole("region", { name: "Send feedback" });
  const token = `e2e-${Date.now()}`;
  const send = async (text: string) => {
    await form.getByRole("radio", { name: "Something's broken" }).click();
    await form.getByLabel("Your message").fill(text);
    await form.getByRole("button", { name: "Send feedback" }).click();
  };
  await send(`${token} a dark calendar, please`);
  await expect(form.getByRole("heading", { name: /Thank you/ })).toBeVisible();

  // The email reaches us (Mailpit locally and in CI); "broken" attaches only the allowed info.
  let found: { ID: string } | undefined;
  for (let i = 0; i < 40 && !found; i++) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:contact@shemme.codes")}`,
    );
    const { messages = [] } = (await res.json()) as {
      messages?: { ID: string; Subject: string }[];
    };
    found = messages.find((m) => m.Subject.includes(token));
    if (!found) await new Promise((r) => setTimeout(r, 750));
  }
  expect(found, "the feedback email").toBeDefined();
  const body = (await (await fetch(`${MAILPIT}/api/v1/message/${found!.ID}`)).json()) as {
    Text: string;
    ReplyTo: { Address: string }[];
  };
  expect(body.Text).toContain("Page: /");
  expect(body.Text).toContain("Screen: ");
  expect(body.Text).not.toContain("Karima");
  expect(body.ReplyTo[0]?.Address).toMatch(/^e2e\.karima\./);

  // Four more are fine; the sixth in 24 hours isn't.
  for (let n = 2; n <= 5; n++) {
    await form.getByRole("button", { name: "Send another" }).click();
    await send(`${token} number ${n}`);
    await expect(form.getByRole("heading", { name: /Thank you/ })).toBeVisible();
  }
  await form.getByRole("button", { name: "Send another" }).click();
  await send(`${token} number 6`);
  await expect(form.getByRole("alert")).toHaveText(/That's 5 messages in a day/);
  await expectAccessible(page, "feedback limit");
});
