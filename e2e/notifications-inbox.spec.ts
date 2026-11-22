import { expect, type Page, test } from "@playwright/test";

import { expectAccessible, profileInviteLink, signUpAndOnboard } from "./helpers";

/**
 * The notification inbox behind the header bell (NOTIFICATIONS_INBOX_ENABLED
 * on the server; CI sets it): an accepted invite and a connection's wishlist
 * update (grouped per person per day) reach the bell; opening, a link and
 * "Mark all as read" work; the empty state; the owner never hears about a
 * reservation; the Settings toggle stops wishlist updates; the phone sheet.
 */
test.skip(
  process.env.NOTIFICATIONS_INBOX_ENABLED !== "true",
  "needs a server started with NOTIFICATIONS_INBOX_ENABLED=true",
);

async function addWish(page: Page, title: string) {
  await page.goto("/wishlists");
  await page.getByRole("button", { name: "Add a wish" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add a wish" });
  await dialog.getByLabel("What do you wish for?").fill(title);
  await dialog.getByRole("button", { name: "Add wish" }).click();
  await expect(dialog).toBeHidden();
}

const bell = (page: Page) =>
  page.locator("[data-slot=page-header]").getByRole("button", { name: /^Notifications/ });

test("invites accepted and wishlist updates reach the bell; reservations never do", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [yasmine, maya] = await Promise.all([a.newPage(), b.newPage()]);
  await yasmine.setViewportSize({ width: 1440, height: 900 });
  await maya.setViewportSize({ width: 1440, height: 900 });
  await signUpAndOnboard(yasmine, "Yasmine");
  await signUpAndOnboard(maya, "Maya");

  // Empty to start with.
  await maya.goto("/people");
  await bell(maya).click();
  await expect(maya.getByText("You're all caught up.")).toBeVisible();
  await expectAccessible(maya, "inbox empty");
  await maya.keyboard.press("Escape");
  await expect(bell(maya)).toBeFocused();

  // Yasmine accepts Maya's invite, then adds two wishes.
  const url = await profileInviteLink(maya);
  await yasmine.goto(url);
  await yasmine.getByRole("button", { name: "Connect with Maya" }).click();
  await expect(yasmine.getByRole("heading", { name: /You're connected/ })).toBeVisible();
  await addWish(yasmine, "Sci-fi box set");
  await addWish(yasmine, "Sunflower seeds");

  await maya.goto("/people");
  await expect(bell(maya)).toHaveAccessibleName("Notifications, 2 unread");
  await bell(maya).click();
  const inbox = maya.getByRole("dialog").or(maya.locator("[data-slot=popover-content]"));
  await expect(inbox.getByText("Yasmine added 2 wishes to their birthday list.")).toBeVisible();
  // She joined through Maya's personal link and isn't one of her people yet.
  await expect(
    inbox.getByText("Yasmine joined through your link. Is this someone you already added?"),
  ).toBeVisible();
  await expectAccessible(maya, "inbox with items");

  // A row opens their list and is read.
  await inbox.getByRole("link", { name: /Yasmine added 2 wishes/ }).click();
  await expect(maya).toHaveURL(/\/wishlists\?tab=friends&friend=/);
  await expect(bell(maya)).toHaveAccessibleName("Notifications, 1 unread");

  // Mark all as read.
  await bell(maya).click();
  await maya.getByRole("button", { name: "Mark all as read" }).click();
  await expect(bell(maya)).toHaveAccessibleName("Notifications");
  await maya.keyboard.press("Escape");

  // Maya reserves one: Yasmine, the owner, never hears about it.
  await maya.getByRole("button", { name: "Reserve it: Sci-fi box set" }).click();
  await expect(maya.getByText("Reserved for Yasmine", { exact: true })).toBeVisible();
  await yasmine.goto("/people");
  await bell(yasmine).click();
  await expect(yasmine.getByText("You're all caught up.")).toBeVisible();
  await yasmine.keyboard.press("Escape");

  // Maya turns wishlist updates off: a new wish brings nothing.
  await maya.goto("/settings/notifications");
  const toggle = maya.getByRole("switch", { name: "Wishlist updates from my people" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(maya.getByText("Saved", { exact: true })).toBeVisible();
  await addWish(yasmine, "Matcha whisk");
  await maya.goto("/people");
  await expect(bell(maya)).toHaveAccessibleName("Notifications");

  await Promise.all([a.close(), b.close()]);
});

test("on phones the inbox is a full-height sheet; Escape returns focus", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndOnboard(page, "Rania");
  await page.goto("/people");
  await bell(page).click();
  const sheet = page.getByRole("dialog", { name: "Notifications" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("You're all caught up.")).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(800);
  await expectAccessible(page, "inbox sheet 390");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(bell(page)).toBeFocused();
});
