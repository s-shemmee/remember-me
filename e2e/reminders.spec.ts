import { expect, test } from "@playwright/test";

import { FAKE_CRON_SECRET } from "../src/test/fake-values";

import { expectAccessible, signUpAndOnboard } from "./helpers";

/**
 * M4 part 1. A user (in London) remembers Khalid, born 13 November 1996.
 * send-reminders runs "at" 10:00 on 6 November 2030 (the `now` override,
 * which only works on a local Supabase with REMINDERS_ALLOW_NOW=1): the
 * 7-day reminder lands in Mailpit with the person, day, countdown, little
 * thing and a signed unsubscribe link. A second run sends nothing. The
 * Settings test email arrives. Unsubscribing turns email reminders off.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const FUNCTIONS =
  process.env.E2E_FUNCTIONS_URL ??
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"}/functions/v1`;
// The placeholder from supabase/functions/local-dev.env (refused off a local Supabase).
const CRON_SECRET = FAKE_CRON_SECRET;

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

/**
 * Runs the reminder job as pg_cron would. A cold or crashed local Edge worker
 * (WORKER_LIMIT, a dropped connection) gets a few more tries, each with its
 * own timeout. Retrying is safe: claims make every run idempotent.
 */
async function runReminders(now: string) {
  let last = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${FUNCTIONS}/send-reminders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${CRON_SECRET}`, "Content-Type": "application/json" },
        body: JSON.stringify({ now }),
        signal: AbortSignal.timeout(45_000),
      });
      if (res.ok) return (await res.json()) as { sent: number };
      last = `${res.status} ${await res.text()}`;
      if (res.status === 401 || res.status === 400) break;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`send-reminders kept failing: ${last}`);
}

test.use({ timezoneId: "Europe/London" });

test("the 7-day reminder arrives once, the test email works, unsubscribe turns email off", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const email = await signUpAndOnboard(page, "Maya");

  // Khalid, 13 November 1996, likes black coffee.
  await page.goto("/people");
  await page.getByRole("button", { name: "Add someone" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add someone" });
  await dialog.getByLabel("Their name").fill("Khalid");
  const bday = dialog.getByRole("group", { name: "Their birthday" });
  await bday.getByRole("combobox", { name: "Day" }).selectOption("13");
  await bday.getByRole("combobox", { name: "Month" }).selectOption("11");
  await bday.getByLabel("Year (optional)").fill("1996");
  await dialog.getByLabel("Little things they love (optional)").fill("black coffee");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await dialog.getByRole("button", { name: "Add Khalid" }).click();
  await expect(dialog).toBeHidden();

  // 8:59 in London: not yet. 10:00: the 7-day reminder.
  await runReminders("2030-11-06T08:59:00Z");
  expect((await messagesTo(email)).filter((m) => /Khalid/.test(m.Subject))).toHaveLength(0);
  await runReminders("2030-11-06T10:00:00Z");
  const summary = await waitForMessage(email, /Khalid turns 34 in 7 days/);

  const message = (await (await fetch(`${MAILPIT}/api/v1/message/${summary.ID}`)).json()) as {
    From: { Name: string; Address: string };
    Subject: string;
    HTML: string;
    Text: string;
  };
  expect(message.From).toMatchObject({
    Name: "Noor · Remember Me",
    Address: "noor@mail.shemme.codes",
  });
  expect(message.Subject).toBe("Khalid turns 34 in 7 days 🎂");
  for (const part of [
    "Hi Maya,",
    "Khalid turns 34 in 7 days",
    "Wednesday 13 November",
    "Little thing: black coffee",
  ]) {
    expect(message.Text).toContain(part);
    expect(message.HTML).toContain(part);
  }
  expect(message.HTML).toContain('lang="en"');
  expect(`${message.HTML}${message.Text}`).not.toMatch(/reserv/i);

  const headers = (await (
    await fetch(`${MAILPIT}/api/v1/message/${summary.ID}/headers`)
  ).json()) as Record<string, string[]>;
  expect(headers["List-Unsubscribe-Post"]?.[0]).toBe("List-Unsubscribe=One-Click");
  expect(headers["List-Unsubscribe"]?.[0]).toMatch(
    /^<http:\/\/127\.0\.0\.1:54321\/functions\/v1\/unsubscribe\?token=[0-9a-f-]{36}\.[A-Za-z0-9_-]+>$/,
  );
  const unsubscribeUrl = /https?:\/\/\S+\/unsubscribe\?token=[0-9a-f-]{36}\.[A-Za-z0-9_-]+/.exec(
    message.Text,
  )?.[0];
  expect(unsubscribeUrl).toBeTruthy();

  // Never twice: the same run again (a retry) sends nothing new.
  await runReminders("2030-11-06T10:15:00Z");
  await page.waitForTimeout(1500);
  expect((await messagesTo(email)).filter((m) => /Khalid/.test(m.Subject))).toHaveLength(1);

  // Settings → Reminders: a test email.
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Reminders" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "By email" })).toBeChecked();
  await expectAccessible(page, "settings");
  // Saved as you go, and still there after a reload.
  await page.getByRole("button", { name: "2 weeks before" }).click();
  await expect(page.getByText("Saved ✓")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "2 weeks before" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // A cold local worker can fail the first time; the page says so and a
  // second press works (3 an hour are allowed).
  const sent = page.getByText(/^Sent to e•••@test\.local\. It can take a minute to arrive\.$/);
  const failed = page.getByText("I couldn't send it just now. Please try again in a minute.");
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Send me a test email" }).click();
    await expect(sent.or(failed)).toBeVisible({ timeout: 60_000 });
    if (await sent.isVisible()) break;
  }
  await expect(sent).toBeVisible();
  await waitForMessage(email, /Your Remember Me reminders are on/);

  // Unsubscribe from the email's link: asks first, then turns email off.
  await page.goto(new URL(unsubscribeUrl!).pathname + new URL(unsubscribeUrl!).search);
  await expect(
    page.getByRole("heading", { level: 1, name: "Stop reminder emails?" }),
  ).toBeVisible();
  await expectAccessible(page, "unsubscribe");
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Done. No more reminder emails" }),
  ).toBeVisible();
  await expectAccessible(page, "unsubscribed");
  await page.getByRole("link", { name: "Open Settings" }).click();
  await expect(page.getByRole("switch", { name: "By email" })).not.toBeChecked();

  // With email off, nothing more is sent (the day-before reminder).
  await runReminders("2030-11-12T10:00:00Z");
  await page.waitForTimeout(1500);
  expect((await messagesTo(email)).filter((m) => /Khalid/.test(m.Subject))).toHaveLength(1);
});
