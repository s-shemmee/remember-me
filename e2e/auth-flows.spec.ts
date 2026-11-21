import { expect, type Page, test } from "@playwright/test";

import { confirmationLink, expectAccessible, PASSWORD, signUpAndOnboard } from "./helpers";

/**
 * Auth flows never reveal whether an email has an account. The screens and
 * the Server Action responses are the same for a new and a registered
 * address; only the owner learns it, by email ("You already have an account").
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const FUNCTIONS =
  process.env.E2E_FUNCTIONS_URL ??
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"}/functions/v1`;

type MailSummary = { ID: string; Subject: string };

async function subjectsTo(email: string): Promise<string[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  return (((await res.json()) as { messages?: MailSummary[] }).messages ?? []).map(
    (m) => m.Subject,
  );
}

async function waitForSubject(email: string, subject: RegExp, times = 1) {
  for (let i = 0; i < 40; i++) {
    if ((await subjectsTo(email)).filter((s) => subject.test(s)).length >= times) return;
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`No "${subject}" (x${times}) for ${email}`);
}

/** Everything a Server Action sends back for a form post, with the email masked. */
function recordActionResponses(page: Page, email: string) {
  const seen: string[] = [];
  page.on("response", async (r) => {
    const req = r.request();
    if (req.method() !== "POST" || !req.headers()["next-action"]) return;
    let body = "";
    try {
      body = await r.text();
    } catch {
      // A redirect has no body.
    }
    seen.push(
      `${r.status()} ${r.headers()["x-action-redirect"] ?? ""} ${body}`
        .replaceAll(email, "EMAIL")
        // Build and request ids differ between any two responses.
        .replace(/"b":"[^"]+"/g, "")
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "ID")
        // React's per-render keys ("e7783382v"): random each time, no data.
        .replace(/"[0-9a-f]{8}[a-z]"/g, '"KEY"'),
    );
  });
  return seen;
}

async function signUp(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("What should we call you?").fill("Sara");
  await page.getByLabel("Email", { exact: true }).filter({ visible: true }).fill(email);
  await page.locator("input[name=password]").filter({ visible: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/\/check-email$/);
}

// getByRole skips the previous page Next keeps mounted (hidden) for Back.
/*
 * Production builds keep the previous page mounted but hidden (so Back is
 * instant): opening /log-in twice leaves two forms in the DOM. Fields are
 * filled with `filter({ visible: true })`, and getByRole skips hidden ones.
 */
const mainText = (page: Page) => page.getByRole("main").innerText();

test("signing up twice: the same screen, a confirmation first and 'you already have an account' next", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const email = `e2e.twice.${Date.now()}@test.local`;

  const first = await browser.newContext();
  const page1 = await first.newPage();
  const seen1 = recordActionResponses(page1, email);
  await signUp(page1, email);
  const screen1 = await mainText(page1);
  await waitForSubject(email, /^Confirm your email/);
  await page1.goto(await confirmationLink(email));
  await expect(page1).toHaveURL(/\/onboarding$/);

  // Someone signs up again with the same (now confirmed) address.
  const second = await browser.newContext();
  const page2 = await second.newPage();
  const seen2 = recordActionResponses(page2, email);
  await signUp(page2, email);
  expect(await mainText(page2)).toBe(screen1);
  expect(seen2).toEqual(seen1);
  await expect(
    page2.getByText("Already have an account? We've emailed you a link to log in instead."),
  ).toBeVisible();
  await expect(page2.getByRole("link", { name: "Log in" }).last()).toHaveAttribute(
    "href",
    "/log-in",
  );
  await expectAccessible(page2, "check your email");

  await waitForSubject(email, /^You already have a Remember Me account$/);
  const subjects = await subjectsTo(email);
  expect(subjects.filter((s) => s.startsWith("Confirm your email"))).toHaveLength(1);

  // Resend: the same answer, then a minute's rest.
  await page2.getByRole("button", { name: "Resend" }).click();
  await expect(page2.getByText("Sent again. It can take a minute to arrive.")).toBeVisible();
  await expect(page2.getByRole("button", { name: /You can send again in a minute/ })).toBeVisible();

  await Promise.all([first.close(), second.close()]);
});

test("log in: a wrong password and an unknown email look exactly the same", async ({ page }) => {
  test.setTimeout(120_000);
  const email = await signUpAndOnboard(page, "Sara");
  await page.context().clearCookies();

  const attempt = async (address: string) => {
    await page.goto("/log-in");
    await page.getByLabel("Email", { exact: true }).filter({ visible: true }).fill(address);
    await page.locator("input[name=password]").filter({ visible: true }).fill("wrong_password_000");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Email or password is incorrect")).toBeVisible();
    return (await mainText(page)).replaceAll(address, "EMAIL");
  };
  const wrong = await attempt(email);
  const unknown = await attempt(`nobody.${Date.now()}@test.local`);
  expect(unknown).toBe(wrong);

  await expect(page.getByRole("link", { name: "Forgot password?" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up", exact: true })).toBeVisible();
  await expect(page.getByText("Signed up with Google? Use Continue with Google")).toBeVisible();
  await expectAccessible(page, "log in, wrong password");
});

test("log in before confirming: 'Please confirm your email first', and Resend sends a new link", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = `e2e.unconfirmed.${Date.now()}@test.local`;
  await signUp(page, email);
  await waitForSubject(email, /^Confirm your email/);
  await page.context().clearCookies();

  await page.goto("/log-in");
  await page.getByLabel("Email", { exact: true }).filter({ visible: true }).fill(email);
  await page.locator("input[name=password]").filter({ visible: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Please confirm your email first")).toBeVisible();
  await page.getByRole("button", { name: "Resend the confirmation link" }).click();
  await expect(page.getByText("Sent again. It can take a minute to arrive.")).toBeVisible();
  await waitForSubject(email, /^Confirm your email/, 2);
  await expectAccessible(page, "log in, not confirmed");
});

test("forgot password: the same answer for a registered and a made-up address", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = await signUpAndOnboard(page, "Sara");
  await page.context().clearCookies();

  const ask = async (address: string) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email", { exact: true }).filter({ visible: true }).fill(address);
    await page.getByRole("button", { name: /Send/ }).click();
    await expect(page.getByText(/If there's an account for that email/)).toBeVisible();
    return (await mainText(page)).replaceAll(address, "EMAIL");
  };
  expect(await ask(`nobody.${Date.now()}@test.local`)).toBe(await ask(email));
});

test("change email to a taken address: the usual 'Almost there', and the owner is told", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pageA, pageB] = await Promise.all([a.newPage(), b.newPage()]);
  const taken = await signUpAndOnboard(pageA, "Amina");
  await signUpAndOnboard(pageB, "Badr");

  await pageB.goto("/settings/account");
  const changeEmail = pageB.locator("form").filter({ has: pageB.getByLabel("New email") });
  await changeEmail.getByLabel("New email").fill(taken);
  await changeEmail.getByLabel("Current password").fill(PASSWORD);
  await changeEmail.getByRole("button", { name: "Change email" }).click();
  await expect(
    pageB.getByText(`Almost there. Check ${taken} (and your current inbox) to confirm the change.`),
  ).toBeVisible();
  await waitForSubject(taken, /^You already have a Remember Me account$/);
  await Promise.all([a.close(), b.close()]);
});

test("account-notice refuses any call without the server secret", async () => {
  for (const authorization of [
    undefined,
    "Bearer sb_publishable_test_00000000",
    "Bearer not-the-secret-0000000000000000000000",
  ]) {
    const res = await fetch(`${FUNCTIONS}/account-notice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify({ email: "anyone@test.local" }),
    });
    expect(res.status).toBe(401);
  }
});

test("the log-in form is in the page from the start, never swapped (autofill survives)", async ({
  request,
}) => {
  // A Suspense fallback form replaced by the real one wiped typed or
  // autofilled values. Only the URL-dependent bits stream in now.
  for (const path of ["/log-in", "/log-in?next=/people", "/log-in?error=link"]) {
    const html = await (await request.get(path)).text();
    expect(html.match(/name="password"/g), path).toHaveLength(1);
  }
  const withNext = await (await request.get("/log-in?next=/people")).text();
  // In both forms: Continue with Google and email.
  expect(withNext.match(/name="next" value="\/people"/g)).toHaveLength(2);
});
