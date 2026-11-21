import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import { FAKE_CRON_SECRET } from "../src/test/fake-values";

import { expectAccessible, PASSWORD, signUpAndOnboard } from "./helpers";

/**
 * M4 part 2: the installable app and push notifications. Needs a production
 * build (the service worker is off in `next dev`), local Supabase and the
 * Edge Functions with PUSH_MOCK=1 (supabase/functions/local-dev.env).
 */
const FUNCTIONS =
  process.env.E2E_FUNCTIONS_URL ??
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"}/functions/v1`;

/** Personal pages and data that must never be in Cache Storage. */
const PRIVATE =
  /\/(home|people|wishlists|settings|profile|calendar|celebrate|invite)\b|_rsc=|supabase|\/rest\/v1|\/storage\/v1/;

async function cachedUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) urls.push(req.url);
    }
    return urls;
  });
}

async function waitForWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first load isn't controlled yet; the next one is (clientsClaim).
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
}

test("installable: manifest, service worker, offline page, nothing private cached", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = (await res.json()) as Record<string, unknown> & {
    icons: { src: string; sizes: string; purpose: string }[];
  };
  expect(manifest).toMatchObject({
    name: "Remember Me",
    short_name: "Remember Me",
    start_url: "/home",
    display: "standalone",
    background_color: "#f4f5f9",
    theme_color: "#f4f5f9",
  });
  expect(manifest.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual([
    "192x192 any",
    "512x512 any",
    "192x192 maskable",
    "512x512 maskable",
  ]);
  for (const icon of manifest.icons) {
    const img = await request.get(icon.src);
    expect(img.ok(), icon.src).toBe(true);
    expect(img.headers()["content-type"]).toBe("image/png");
  }

  await signUpAndOnboard(page, "Maya");
  await waitForWorker(page);
  const sw = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).active?.scriptURL ?? "",
  );
  expect(sw).toMatch(/\/serwist\/sw\.js$/);

  // Browse a few private pages while online…
  for (const path of ["/home", "/people", "/wishlists", "/settings"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  }
  // …and none of them, nor any data, ends up cached.
  const cached = await cachedUrls(page);
  expect(cached.length).toBeGreaterThan(0);
  expect(cached.filter((u) => PRIVATE.test(new URL(u).pathname + new URL(u).search))).toEqual([]);
  expect(cached.some((u) => new URL(u).pathname === "/offline")).toBe(true);

  // Offline: Noor's page instead of an error.
  await page.context().setOffline(true);
  await page.goto("/people").catch(() => undefined);
  await expect(
    page.getByRole("heading", { level: 1, name: "No connection right now" }),
  ).toBeVisible();
  await expect(page.getByText("You're offline. I'll be here when you're back 🕯️")).toBeVisible();
  await expectAccessible(page, "offline");
  await page.context().setOffline(false);
});

/**
 * Headless Chromium has no push service, so subscribe() is replaced with
 * one returning a real-shaped subscription (a real P-256 key, an FCM-style
 * endpoint); the server side (save, send with encryption and VAPID, mock
 * push service) runs for real.
 */
async function fakePushManager(context: BrowserContext) {
  await context.addInitScript(() => {
    const KEY = "rm-e2e-push";
    const b64url = (bytes: ArrayBuffer) =>
      btoa(String.fromCharCode(...new Uint8Array(bytes)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    const make = (data: { endpoint: string; p256dh: string; auth: string }) => ({
      endpoint: data.endpoint,
      expirationTime: null,
      options: { userVisibleOnly: true },
      getKey: () => null,
      toJSON: () => ({
        endpoint: data.endpoint,
        expirationTime: null,
        keys: { p256dh: data.p256dh, auth: data.auth },
      }),
      unsubscribe: async () => {
        localStorage.removeItem(KEY);
        return true;
      },
    });
    if (!("PushManager" in self)) return;
    PushManager.prototype.getSubscription = async function () {
      const saved = localStorage.getItem(KEY);
      return (saved ? make(JSON.parse(saved)) : null) as unknown as PushSubscription;
    };
    PushManager.prototype.subscribe = async function () {
      const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
        "deriveBits",
      ]);
      const data = {
        endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${crypto.randomUUID()}`,
        p256dh: b64url(await crypto.subtle.exportKey("raw", pair.publicKey)),
        auth: b64url(crypto.getRandomValues(new Uint8Array(16)).buffer),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return make(data) as unknown as PushSubscription;
    };
  });
}

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
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`send-reminders kept failing: ${last}`);
}

test.use({ timezoneId: "Europe/London" });

test("notifications: turn on, a reminder and a test push, the worker shows it, log out removes the device", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ timezoneId: "Europe/London" });
  await context.grantPermissions(["notifications"], {
    origin: new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000").origin,
  });
  await fakePushManager(context);
  const page = await context.newPage();
  const email = await signUpAndOnboard(page, "Maya");

  await page.goto("/people");
  await page.getByRole("button", { name: "Add someone" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add someone" });
  await dialog.getByLabel("Their name").fill("Khalid");
  const bday = dialog.getByRole("group", { name: "Their birthday" });
  await bday.getByRole("combobox", { name: "Day" }).selectOption("13");
  await bday.getByRole("combobox", { name: "Month" }).selectOption("11");
  await dialog.getByRole("button", { name: "Add Khalid" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/settings/notifications");
  await waitForWorker(page);
  const card = page.getByRole("region", { name: "Notifications" });
  const turnOn = card.getByRole("button", { name: "Turn on notifications" });
  await expect(turnOn).toBeVisible();
  await expectAccessible(page, "settings, notifications off");
  await turnOn.click();
  await expect(card.getByText("Notifications are on for this device ✓")).toBeVisible();
  const devices = card.getByRole("list", { name: "Your devices" });
  await expect(devices.getByRole("listitem")).toHaveCount(1);
  await expect(devices).toContainText("· This device");
  await expect(devices).toContainText("Not used yet");
  await expectAccessible(page, "settings, notifications on");

  // The reminder job pushes once (mock push service, real encryption).
  await runReminders("2030-11-06T10:00:00Z");
  await runReminders("2030-11-06T10:15:00Z");
  await page.reload();
  await expect(devices).toContainText("Last used today");

  // A test notification (a cold local worker may need a second press).
  const sent = card.getByText("Sent to 1 device. It should pop up in a moment.");
  const failed = card.getByText("I couldn't send it just now. Please try again in a minute.");
  for (let i = 0; i < 2; i++) {
    await card.getByRole("button", { name: "Send me a test notification" }).click();
    await expect(sent.or(failed)).toBeVisible({ timeout: 60_000 });
    if (await sent.isVisible()) break;
  }
  await expect(sent).toBeVisible();

  // The service worker shows a push (delivered through Chrome DevTools).
  const cdp = await context.newCDPSession(page);
  const origin = new URL(page.url()).origin;
  // This site's live registration (the event can list others, or stale ones).
  const registrations = new Map<string, string>();
  cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations: list }) => {
    for (const r of list as { registrationId: string; scopeURL: string; isDeleted: boolean }[]) {
      if (r.isDeleted) registrations.delete(r.scopeURL);
      else registrations.set(r.scopeURL, r.registrationId);
    }
  });
  await cdp.send("ServiceWorker.enable");
  await expect.poll(() => registrations.get(`${origin}/`)).toBeTruthy();
  const shown = () =>
    page.evaluate(async () =>
      (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => n.title),
    );
  for (let attempt = 0; attempt < 3; attempt++) {
    await cdp.send("ServiceWorker.deliverPushMessage", {
      origin,
      registrationId: registrations.get(`${origin}/`)!,
      data: JSON.stringify({
        title: "Khalid's birthday is in 7 days 🎂",
        body: "Friday 13 November",
        url: "/people",
        tag: "e2e-1",
      }),
    });
    const titles = await expect
      .poll(shown, { timeout: 5_000 })
      .toContain("Khalid's birthday is in 7 days 🎂")
      .then(() => true)
      .catch(() => false);
    if (titles) break;
  }
  await expect.poll(shown).toContain("Khalid's birthday is in 7 days 🎂");

  // Logging out removes this device; back in, there's nothing to push to.
  await page
    .getByRole("button", { name: /account menu|Open the menu|Maya/i })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/log-in/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.getByRole("button", { name: /^Log in/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/settings/notifications");
  await expect(card.getByRole("button", { name: "Turn on notifications" })).toBeVisible();
  await expect(card.getByRole("list", { name: "Your devices" })).toHaveCount(0);

  await context.close();
});
