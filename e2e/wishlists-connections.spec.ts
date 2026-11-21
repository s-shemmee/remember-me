import { expect, test } from "@playwright/test";

import { hasMetadata, withGpsExif } from "./exif";
import { confirmationLink, expectAccessible, PASSWORD, signUpAndOnboard } from "./helpers";

/**
 * M3 part 1. A adds a wish with a photo (its GPS data must not survive),
 * adds Bilal to People and invites him from his profile. B opens the link,
 * signs up, confirms, onboards, is brought back to the invite and accepts.
 * Both see the connection, and A's "Bilal" is linked automatically.
 */
test("A invites, B accepts, both see the connection; photos lose their location", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const a = await browser.newContext();
  const pageA = await a.newPage();
  await signUpAndOnboard(pageA, "Amina");

  // A: a wish with a photo that has GPS data.
  await pageA.goto("/wishlists");
  await expect(pageA.getByText("Add the first thing you'd love")).toBeVisible();
  await expectAccessible(pageA, "wishlists, empty");
  const base = Buffer.from(
    await pageA.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 48;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#d63b48";
      ctx.fillRect(0, 0, 64, 48);
      return c.toDataURL("image/jpeg").split(",")[1]!;
    }),
    "base64",
  );
  const photo = withGpsExif(base);
  expect(hasMetadata(photo)).toBe(true); // the test photo really has EXIF

  await pageA.getByRole("button", { name: "Add a wish" }).first().click();
  const dialog = pageA.getByRole("dialog", { name: "Add a wish" });
  await dialog.getByLabel("What do you wish for?").fill("Ottolenghi cookbook");
  await dialog.getByLabel("Link (optional)").fill("https://www.librairie.ma/ottolenghi");
  await dialog.getByLabel("Price (optional)").fill("420");
  await dialog.getByRole("radio", { name: "Love it" }).click();
  await dialog.getByLabel("Choose a photo").setInputFiles({
    name: "cookbook.jpg",
    mimeType: "image/jpeg",
    buffer: photo,
  });
  await expect(dialog.getByRole("img", { name: "Your photo for this wish" })).toBeVisible();
  await expectAccessible(pageA, "wish dialog");
  await dialog.getByRole("button", { name: "Add wish" }).click();
  await expect(dialog).toBeHidden();

  const card = pageA.locator("[data-wish-id]").filter({ hasText: "Ottolenghi cookbook" });
  await expect(card).toContainText("420 MAD · librairie.ma");
  await expect(card).toContainText("Love it");
  const link = card.getByRole("link", { name: /Open link/ });
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
  // The stored photo (private bucket, signed URL) has no EXIF/GPS left.
  const src = await card.locator("img").getAttribute("src");
  expect(src).toContain("/storage/v1/object/sign/wish-images/");
  const stored = Buffer.from(await (await fetch(src!)).arrayBuffer());
  expect(stored.length).toBeGreaterThan(0);
  expect(hasMetadata(stored)).toBe(false);
  await expectAccessible(pageA, "wishlists, with a wish");

  // A: Bilal in People, invited from his profile.
  await pageA.goto("/people");
  await pageA.getByRole("button", { name: "Add someone" }).first().click();
  const person = pageA.getByRole("dialog", { name: "Add someone" });
  await person.getByLabel("Their name").fill("Bilal");
  const bday = person.getByRole("group", { name: "Their birthday" });
  await bday.getByRole("combobox", { name: "Day" }).selectOption("9");
  await bday.getByRole("combobox", { name: "Month" }).selectOption("9");
  await person.getByRole("button", { name: "Add Bilal" }).click();
  await expect(person).toBeHidden();
  await pageA.getByRole("button", { name: "Invite Bilal to Remember Me" }).click();
  const invite = pageA.getByRole("dialog", { name: "Invite Bilal to Remember Me" });
  const inviteUrl = await invite.getByLabel("Invite link").inputValue();
  expect(inviteUrl).toMatch(/\/invite\/[0-9a-f]{64}$/);
  await expectAccessible(pageA, "invite dialog");
  await pageA.keyboard.press("Escape");

  // B: opens the link signed out, signs up, confirms, onboards, accepts.
  const b = await browser.newContext();
  const pageB = await b.newPage();
  await pageB.goto(inviteUrl);
  await expect(
    pageB.getByRole("heading", { level: 1, name: "Amina invited you to connect" }),
  ).toBeVisible();
  await expectAccessible(pageB, "invite page, signed out");
  await pageB.getByRole("link", { name: "Create my account" }).click();
  await expect(pageB).toHaveURL(/\/sign-up$/);
  const cookie = (await b.cookies()).find((c) => c.name === "rm-invite");
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax" });

  const emailB = `e2e.bilal.${Date.now()}@test.local`;
  await pageB.getByLabel("What should we call you?").fill("Bilal");
  await pageB.getByLabel("Email", { exact: true }).fill(emailB);
  await pageB.locator("input[name=password]").fill(PASSWORD);
  await pageB.getByRole("button", { name: "Create my account" }).click();
  await expect(pageB).toHaveURL(/\/check-email$/);
  await pageB.goto(await confirmationLink(emailB));
  await expect(pageB).toHaveURL(/\/onboarding$/);
  await pageB.getByRole("combobox", { name: "Day" }).selectOption("9");
  await pageB.getByRole("combobox", { name: "Month" }).selectOption("9");
  await pageB.getByRole("button", { name: /^Continue/ }).click();
  await pageB.getByRole("button", { name: "Skip for now" }).click();
  await pageB.getByRole("button", { name: "Skip for now" }).click();
  await pageB.getByRole("button", { name: "Finish" }).click();
  await pageB.getByRole("link", { name: "Take me home" }).click();

  // Back on the invite (the cookie is used once and cleared).
  await expect(pageB).toHaveURL(/\/invite\/[0-9a-f]{64}$/);
  expect((await b.cookies()).some((c) => c.name === "rm-invite")).toBe(false);
  await pageB.getByRole("button", { name: "Connect with Amina" }).click();
  await expect(pageB.getByRole("heading", { name: /You're connected with Amina/ })).toBeVisible();

  // Both see the connection.
  await pageB.goto("/profile");
  const listB = pageB.getByRole("region", { name: "Connected with you" });
  await expect(
    listB.getByRole("list", { name: "Your connections" }).getByText("Amina", { exact: true }),
  ).toBeVisible();
  await expectAccessible(pageB, "profile, B");

  await pageA.goto("/profile");
  const listA = pageA.getByRole("region", { name: "Connected with you" });
  await expect(listA.getByText("Bilal", { exact: true }).first()).toBeVisible();
  // Invited from Bilal's profile: linked to him automatically (under Manage connections).
  await listA.getByText("Manage connections").click();
  await expect(listA.getByLabel("This is…")).toHaveValue(/[0-9a-f-]{36}/);
  await expect(listA.getByLabel("This is…").locator("option:checked")).toHaveText("Bilal");
  // The used invite is gone: no open invites listed.
  await expect(
    pageA.getByRole("region", { name: "Invite your people" }).getByText("Open invites"),
  ).toHaveCount(0);
  await expectAccessible(pageA, "profile, A");

  await pageA.goto("/people");
  await expect(pageA.getByRole("link", { name: /^Bilal/ })).toContainText("Connected");

  // The used link can't be used again.
  await pageB.goto(inviteUrl);
  await expect(pageB.getByRole("heading", { level: 1 })).toHaveText(
    /already connected|already been used/,
  );

  await a.close();
  await b.close();
});
