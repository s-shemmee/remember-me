import { expect, type Page, test } from "@playwright/test";

import { expectAccessible, profileInviteLink, signUpAndOnboard } from "./helpers";

/** A copies an invite link on Profile; `page` (signed in) accepts it. */
async function connect(pageA: Page, page: Page) {
  const url = await profileInviteLink(pageA);
  await page.goto(url);
  await page.getByRole("button", { name: "Connect with Amina" }).click();
  await expect(page.getByRole("heading", { name: /You're connected with Amina/ })).toBeVisible();
}

/**
 * M3 part 2. A adds a wish; B and C are connected to A. B reserves it. A's
 * view doesn't change at all (same card, no reservation data in any page or
 * RSC response). C sees "Already taken", never who. A removes the wish, and
 * B gets a quiet note.
 */
test("B reserves A's wish in secret; A sees nothing; C sees it's taken", async ({ browser }) => {
  test.setTimeout(240_000);
  const [a, b, c] = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const [pageA, pageB, pageC] = await Promise.all([a.newPage(), b.newPage(), c.newPage()]);
  await signUpAndOnboard(pageA, "Amina");
  await signUpAndOnboard(pageB, "Badr");
  await signUpAndOnboard(pageC, "Chama");
  await connect(pageA, pageB);
  await connect(pageA, pageC);

  // A adds a wish to "My birthday".
  await pageA.goto("/wishlists");
  await pageA.getByRole("button", { name: "Add a wish" }).first().click();
  const dialog = pageA.getByRole("dialog", { name: "Add a wish" });
  await dialog.getByLabel("What do you wish for?").fill("Little olive tree");
  await dialog.getByLabel("Price (optional)").fill("260");
  await dialog.getByRole("button", { name: "Add wish" }).click();
  await expect(dialog).toBeHidden();
  await expect(pageA.getByText("Your connections can see this list")).toBeVisible();
  await pageA.reload();
  const cardA = pageA.locator("[data-wish-id]").filter({ hasText: "Little olive tree" });
  await expect(cardA).toBeVisible();
  const before = await cardA.evaluate((el) => el.outerHTML);
  const mainBefore = await pageA.locator("main").filter({ visible: true }).innerText();

  // B: Friends' wishlists → Amina → Reserve it.
  await pageB.goto("/wishlists?tab=friends");
  await expect(pageB.getByRole("heading", { name: "Amina's birthday wishlist" })).toBeVisible();
  await expectAccessible(pageB, "friends' wishlists, B");
  await pageB.getByRole("button", { name: "Reserve it: Little olive tree" }).click();
  await expect(pageB.getByText("Reserved for Amina", { exact: true })).toBeVisible();
  const cardB = pageB.locator("[data-friend-wish-id]").filter({ hasText: "Little olive tree" });
  await expect(cardB).toContainText("Reserved by you");
  await pageB.reload();
  await expect(cardB).toContainText("Reserved by you");
  await expect(pageB.getByText(/you have 1 gift reserved for Amina/)).toBeVisible();
  await expectAccessible(pageB, "friends' wishlists, reserved");

  // A: nothing changed, and no response she receives mentions it.
  const bodies: string[] = [];
  pageA.on("response", async (r) => {
    const type = r.request().resourceType();
    if (type !== "document" && type !== "fetch") return;
    try {
      bodies.push(await r.text());
    } catch {
      // Redirects have no body.
    }
  });
  await pageA.reload();
  await expect(cardA).toBeVisible();
  expect(await cardA.evaluate((el) => el.outerHTML)).toBe(before);
  expect(await pageA.locator("main").filter({ visible: true }).innerText()).toBe(mainBefore);
  await pageA.getByRole("tab", { name: "Friends' wishlists" }).click();
  await pageA.getByRole("tab", { name: "My wishlists" }).click();
  await pageA.goto("/home");
  await expect(pageA.getByText("GIFTS SORTED")).toBeVisible();
  expect(bodies.length).toBeGreaterThan(0);
  for (const body of bodies) {
    expect(body).not.toMatch(
      /reserved|already taken|reserver|cancelled_at|"status":"(mine|taken)"/i,
    );
  }

  // C: sees it's taken, never by whom.
  await pageC.goto("/wishlists?tab=friends");
  const cardC = pageC.locator("[data-friend-wish-id]").filter({ hasText: "Little olive tree" });
  await expect(cardC).toContainText("Already taken");
  await expect(cardC).not.toContainText("Badr");
  await expect(cardC.getByRole("button")).toHaveCount(0);
  await expectAccessible(pageC, "friends' wishlists, C");

  // B's Home counts it under "Gifts sorted".
  await pageB.goto("/home");
  await expect(pageB.getByText("GIFTS SORTED")).toBeVisible();
  await expectAccessible(pageB, "home, B");

  // A removes the wish: B's reservation is cancelled with a quiet note.
  await pageA.goto("/wishlists");
  await cardA.getByRole("button", { name: "Options for Little olive tree" }).click();
  await pageA.getByRole("menuitem", { name: "Remove" }).click();
  await expect(cardA).toHaveCount(0);
  await pageB.goto("/wishlists?tab=friends");
  await expect(pageB.getByText("Amina removed a wish you'd reserved")).toBeVisible();
  await expect(cardB).toHaveCount(0);
  await expectAccessible(pageB, "friends' wishlists, note");
  await pageB.getByRole("button", { name: /^OK, hide the note/ }).click();
  await expect(pageB.getByText("Amina removed a wish you'd reserved")).toBeHidden();

  await Promise.all([a.close(), b.close(), c.close()]);
});
