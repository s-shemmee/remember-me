import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import { hasMetadata, withGpsExif } from "./exif";
import { expectAccessible, PASSWORD, signUpAndOnboard } from "./helpers";

/**
 * M5 part 1. Profile: a photo (its GPS must not survive), birthday sharing
 * (a connected friend loses the date when it's off), "In memory" wording,
 * and deleting an account (re-authentication checked by the Edge Function
 * itself; afterwards the account can't log in).
 */
const FUNCTIONS =
  process.env.E2E_FUNCTIONS_URL ??
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"}/functions/v1`;

test.use({ timezoneId: "Europe/London" });

async function connect(pageA: Page, page: Page, inviterName: string) {
  await pageA.goto("/profile");
  await pageA.getByRole("button", { name: "Create an invite link" }).click();
  const url = await pageA.getByRole("dialog").getByLabel("Invite link").inputValue();
  await pageA.keyboard.press("Escape");
  await page.goto(url);
  await page.getByRole("button", { name: `Connect with ${inviterName}` }).click();
  await expect(page.getByRole("heading", { name: /You're connected/ })).toBeVisible();
}

/** The signed-in user's access token, from the Supabase SSR cookie. */
async function accessToken(context: BrowserContext): Promise<string> {
  const parts = (await context.cookies())
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value)
    .join("");
  const raw = parts.startsWith("base64-")
    ? Buffer.from(parts.slice(7), "base64").toString()
    : parts;
  return (JSON.parse(raw) as { access_token: string }).access_token;
}

/** A day + month a few days from today in London. */
function inDays(n: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "numeric",
  }).formatToParts(new Date(Date.now() + n * 86_400_000));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { day: get("day"), month: get("month") };
}

test("profile photo without location data, and birthday sharing on and off", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pageA = await a.newPage();
  const pageB = await b.newPage();
  await signUpAndOnboard(pageA, "Amina");
  await signUpAndOnboard(pageB, "Badr");
  await connect(pageA, pageB, "Amina");

  // A: a photo with GPS data.
  await pageA.goto("/profile");
  const about = pageA.getByRole("region", { name: "About you" });
  await expect(about.getByLabel("First name")).toHaveValue("Amina");
  await expectAccessible(pageA, "profile");
  const base = Buffer.from(
    await pageA.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 120;
      c.height = 80;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#3d6be0";
      ctx.fillRect(0, 0, 120, 80);
      return c.toDataURL("image/jpeg").split(",")[1]!;
    }),
    "base64",
  );
  const photo = withGpsExif(base);
  expect(hasMetadata(photo)).toBe(true);
  await about.getByRole("radio", { name: "Photo" }).click();
  await about
    .getByLabel("Your photo")
    .setInputFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect(about.getByText("Uploading…")).toBeHidden();
  await about.getByRole("button", { name: "Save changes" }).click();
  await expect(about.getByText("Saved ✓")).toBeVisible();

  await pageA.reload();
  const img = about.locator("img").first();
  await expect(img).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/avatars\//);
  const stored = Buffer.from(await (await fetch((await img.getAttribute("src"))!)).arrayBuffer());
  expect(stored.length).toBeGreaterThan(0);
  expect(hasMetadata(stored)).toBe(false);

  // B sees A's birthday (22 November, from onboarding)...
  await pageB.goto("/wishlists?tab=friends");
  const picker = pageB.getByRole("group", { name: "Friends" });
  await expect(picker.getByRole("button", { name: /Amina/ })).toContainText(
    /Birthday (in|today|tomorrow)/,
  );

  // ...until A hides it.
  await pageA.getByRole("switch", { name: /Show my birthday to my connections/ }).click();
  await expect(pageA.getByText(/Hidden\. Your connections won't see your birthday/)).toBeVisible();
  await pageB.reload();
  await expect(picker.getByRole("button", { name: /Amina/ })).toContainText("No birthday shared");
  await pageB.goto("/home");
  await expect(pageB.getByText("GIFTS SORTED")).toBeVisible();

  await a.close();
  await b.close();
});

test('"In memory" makes every day of theirs gentle', async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "Maya");
  const soon = inDays(3);
  await page.goto("/people");
  await page.getByRole("button", { name: "Add someone" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add someone" });
  await dialog.getByLabel("Their name").fill("Grandma");
  const bday = dialog.getByRole("group", { name: "Their birthday" });
  await bday.getByRole("combobox", { name: "Day" }).selectOption(soon.day);
  await bday.getByRole("combobox", { name: "Month" }).selectOption(soon.month);
  await bday.getByLabel("Year (optional)").fill("1940");
  await dialog.getByRole("button", { name: "Add Grandma" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/home");
  await expect(page.getByText(/Grandma turns \d+ in 3 days 🎂/)).toBeVisible();

  await page.goto("/people");
  await page.getByRole("link", { name: /^Grandma/ }).click();
  const memory = page.getByRole("switch", { name: "In memory" });
  await expect(memory).not.toBeChecked();
  await memory.click();
  await expect(page.getByText("Their days will be gentle from now on 🕊️")).toBeVisible();
  await expectAccessible(page, "person, in memory");

  await page.goto("/home");
  await expect(page.getByText("Grandma's birthday is in 3 days 🕊️")).toBeVisible();
  const main = page.locator("main").filter({ visible: true });
  await expect(main).not.toContainText(/Grandma turns/);
  await expect(page.getByRole("button", { name: /Reserve it/ })).toHaveCount(0);
});

test("delete my account: checked again by the Edge Function, then it can't log in", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const email = await signUpAndOnboard(page, "Driss");

  // The Edge Function checks for itself, whatever the app sends.
  const token = await accessToken(context);
  const call = (body: object) =>
    fetch(`${FUNCTIONS}/delete-account`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: (await r.json()) as { error?: string } }));
  expect(await call({ email: "someone@else.test" })).toEqual({
    status: 400,
    body: { error: "email_mismatch" },
  });
  expect(await call({ email })).toEqual({ status: 400, body: { error: "wrong_password" } });
  expect(await call({ email, password: "not-my-password" })).toEqual({
    status: 400,
    body: { error: "wrong_password" },
  });
  const anonymous = await fetch(`${FUNCTIONS}/delete-account`, { method: "POST", body: "{}" });
  expect(anonymous.status).toBe(401);

  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete my account…" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete your account?" });
  await expectAccessible(page, "delete dialog");
  await dialog.getByLabel(`Type ${email}`).fill(email);
  await dialog.getByLabel("Your password").fill("wrong-password");
  await dialog.getByRole("button", { name: "Delete forever" }).click();
  await expect(dialog.getByText("That password isn't right.")).toBeVisible();
  await dialog.getByLabel("Your password").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Delete forever" }).click();

  await expect(page).toHaveURL(/\/log-in\?deleted=1$/, { timeout: 60_000 });
  await expect(
    page.getByText("Your account and everything in it are deleted. Take care 💛"),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.getByRole("button", { name: /^Log in/ }).click();
  await expect(page.getByText("Email or password is incorrect")).toBeVisible();
  await expect(page).toHaveURL(/\/log-in/);
});
