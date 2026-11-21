import { expect, type Page, test } from "@playwright/test";

import { FAKE_CRON_SECRET } from "../src/test/fake-values";

import { expectAccessible, signUpAndOnboard } from "./helpers";

/**
 * M5 part 2: birthday plans and Celebrate Me.
 * - A plan from Home: tick steps on the card, the Coming up dots follow, and
 *   it's still there after a reload.
 * - Reserving a friend's gift ticks "Gift" in your plan for them; the friend
 *   (the wish owner) never sees a plan.
 * - "Remind me about my own day": the 7-day reminder and the birthday
 *   message land in Mailpit, once each.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const FUNCTIONS =
  process.env.E2E_FUNCTIONS_URL ??
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"}/functions/v1`;

test.use({ timezoneId: "Europe/London" });

/** Day and month `days` from today on London's wall clock. */
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

test("a plan from Home: tick steps and the dots follow", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "Maya");
  await addPerson(page, "Khalid", soon(3));

  await page.goto("/home");
  const card = page.getByRole("region", { name: "Khalid's birthday plan" });
  await expect(card).toContainText("no plan yet");
  const comingUp = page.getByRole("region", { name: "Coming up" });
  await expect(comingUp.getByRole("img", { name: /^Plan/ })).toHaveCount(0);
  await expectAccessible(page, "home, plan card");

  // Ticking a suggestion starts the plan.
  await card.getByRole("button", { name: "Gift", pressed: false }).click();
  await expect(card.getByRole("button", { name: "Gift", pressed: true })).toBeVisible();
  await expect(comingUp.getByRole("img", { name: "Plan 1 of 5 done" })).toBeVisible();
  await card.getByRole("button", { name: "Message", pressed: false }).click();
  await expect(comingUp.getByRole("img", { name: "Plan 2 of 5 done" })).toBeVisible();

  // The whole plan: rename a step, add one, a note.
  await card.getByRole("button", { name: "Plan their day" }).click();
  const sheet = page.getByRole("dialog", { name: "Khalid's birthday plan" });
  await expect(sheet).toContainText("2 of 5 done");
  await sheet.getByRole("button", { name: "Rename Cake" }).click();
  await sheet.getByRole("textbox", { name: "Rename Cake" }).fill("Fig cake");
  await sheet.getByRole("textbox", { name: "Rename Cake" }).press("Enter");
  await expect(sheet.getByRole("checkbox", { name: /Fig cake/ })).toBeVisible();
  await sheet.getByRole("textbox", { name: "Add a step" }).fill("Book the rooftop");
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sheet.getByRole("checkbox", { name: /Book the rooftop/ })).toBeVisible();
  await sheet.getByRole("checkbox", { name: /Book the rooftop/ }).click();
  await expect(sheet.getByRole("checkbox", { name: /Book the rooftop/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await sheet.getByRole("textbox", { name: "A short note" }).fill("He loves the sunset");
  await sheet.getByRole("button", { name: "Save note" }).click();
  await expect(sheet.getByText("Note saved")).toBeVisible();
  await expectAccessible(page, "plan sheet");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(comingUp.getByRole("img", { name: "Plan 3 of 6 done" })).toBeVisible();

  // Saved: still there after a reload, and on Khalid's profile.
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Coming up" }).getByRole("img", {
      name: "Plan 3 of 6 done",
    }),
  ).toBeVisible();
  await page.goto("/people");
  await page
    .getByRole("link", { name: /Khalid/ })
    .first()
    .click();
  await expect(page.getByText("3 of 6 done")).toBeVisible();
  await expectAccessible(page, "people, plan section");
});

test("reserving a friend's gift ticks Gift in my plan for them", async ({ browser }) => {
  test.setTimeout(240_000);
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pageA, pageB] = await Promise.all([a.newPage(), b.newPage()]);
  await signUpAndOnboard(pageA, "Amina");
  await signUpAndOnboard(pageB, "Badr");

  // B remembers Amina and invites her from her profile (so she's linked).
  await addPerson(pageB, "Amina", soon(5));
  await pageB.getByRole("button", { name: "Invite Amina to Remember Me" }).click();
  const url = await pageB
    .getByRole("dialog", { name: "Invite Amina to Remember Me" })
    .getByLabel("Invite link")
    .inputValue();
  await pageB.keyboard.press("Escape");
  await pageA.goto(url);
  await pageA.getByRole("button", { name: "Connect with Badr" }).click();
  await expect(pageA.getByRole("heading", { name: /You're connected with Badr/ })).toBeVisible();

  // A adds a wish; B reserves it.
  await pageA.goto("/wishlists");
  await pageA.getByRole("button", { name: "Add a wish" }).first().click();
  const wish = pageA.getByRole("dialog", { name: "Add a wish" });
  await wish.getByLabel("What do you wish for?").fill("Little olive tree");
  await wish.getByRole("button", { name: "Add wish" }).click();
  await expect(wish).toBeHidden();
  await pageB.goto("/wishlists?tab=friends");
  await pageB.getByRole("button", { name: "Reserve it: Little olive tree" }).click();
  await expect(pageB.getByText("Reserved for Amina", { exact: true })).toBeVisible();

  // B's plan for Amina: Gift is ticked.
  await pageB.goto("/home");
  const card = pageB.getByRole("region", { name: "Amina's birthday plan" });
  await expect(card.getByRole("button", { name: "Gift", pressed: true })).toBeVisible();
  await expect(
    pageB.getByRole("region", { name: "Coming up" }).getByRole("img", { name: "Plan 1 of 5 done" }),
  ).toBeVisible();

  // A never sees a plan, or that anything was reserved.
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
  await pageA.goto("/home");
  await pageA.goto("/celebrate");
  await pageA.goto("/wishlists");
  expect(bodies.length).toBeGreaterThan(0);
  for (const body of bodies)
    expect(body).not.toMatch(/Badr's plan|ticked_by|reservation"|reserved/i);

  await Promise.all([a.close(), b.close()]);
});

test("Celebrate Me: a sealed note, and own-day reminders by email", async ({ page }) => {
  test.setTimeout(300_000);
  // The reminder runs below use a fixed clock around 22 November 2030.
  const email = await signUpAndOnboard(page, "Maya", { day: "22", month: "11" });

  await page.goto("/celebrate");
  await expect(page.getByRole("heading", { level: 1, name: "Celebrate Me" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Countdown" })).toContainText("22 November");
  await expectAccessible(page, "celebrate");

  // A note to future me: sealed once saved.
  const note = page.getByRole("region", { name: "A NOTE TO FUTURE ME" });
  await note.getByLabel("Write a note to open on your birthday").fill("Dear me, you did it.");
  await note.getByRole("button", { name: "Seal it until my birthday" }).click();
  await expect(note).toContainText("Sealed until 22 November");
  await page.reload();
  await expect(note).toContainText("Sealed until 22 November");
  await expect(page.getByText("Dear me, you did it.")).toHaveCount(0);

  // Own-day reminders: off by default.
  const remind = page.getByRole("switch", { name: "Remind me about my own day" });
  await expect(remind).toHaveAttribute("aria-checked", "false");
  await remind.click();
  await expect(page.getByText(/I'll remind you 7 days before/)).toBeVisible();
  await expectAccessible(page, "celebrate, switch on");

  // 15 November 2030, 10:00 in London: 7 days before. Then the day itself.
  await runReminders("2030-11-15T10:00:00Z");
  const week = await waitForMessage(email, /^Your day is in 7 days/);
  const message = (await (await fetch(`${MAILPIT}/api/v1/message/${week.ID}`)).json()) as {
    Subject: string;
    Text: string;
  };
  expect(message.Subject).toBe("Your day is in 7 days ✨");
  expect(message.Text).toContain("Time to update your wishlist?");
  await runReminders("2030-11-15T11:00:00Z");
  await runReminders("2030-11-22T10:00:00Z");
  await waitForMessage(email, /^Happy birthday, Maya! 🎉$/);
  const subjects = (await messagesTo(email)).map((m) => m.Subject);
  expect(subjects.filter((s) => s.startsWith("Your day is in 7 days"))).toHaveLength(1);
});

type MailSummary = { ID: string; Subject: string };

async function messagesTo(email: string): Promise<MailSummary[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  return ((await res.json()) as { messages?: MailSummary[] }).messages ?? [];
}

async function waitForMessage(email: string, subject: RegExp): Promise<MailSummary> {
  for (let i = 0; i < 40; i++) {
    const found = (await messagesTo(email)).find((m) => subject.test(m.Subject));
    if (found) return found;
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`No email "${subject}" for ${email}`);
}

/** Runs the reminder job as pg_cron would (retried: claims make runs idempotent). */
async function runReminders(now: string) {
  let last = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${FUNCTIONS}/send-reminders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FAKE_CRON_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ now }),
        signal: AbortSignal.timeout(45_000),
      });
      if (res.ok) return;
      last = `${res.status} ${await res.text()}`;
      if (res.status === 401 || res.status === 400) break;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`send-reminders kept failing: ${last}`);
}
