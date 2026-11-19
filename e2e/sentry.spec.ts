import { expect, test } from "@playwright/test";

/**
 * No Session Replay: the browser never fetches Sentry's Replay bundle
 * (browser.sentry-cdn.com/…/replay.min.js), not on load, not after the first
 * interaction (when the old lazy loader kicked in).
 */
test("no Sentry Replay is ever loaded", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));

  for (const path of ["/", "/log-in"]) {
    await page.goto(path);
    await page.mouse.click(5, 5);
    await page.keyboard.press("Tab");
    await page.mouse.wheel(0, 400);
    await page.waitForLoadState("networkidle");
  }

  expect(requests.filter((u) => /sentry-cdn\.com|replay/i.test(u))).toEqual([]);
  // The bundle doesn't carry Replay's recorder either.
  const scripts = await page.evaluate(() =>
    [...document.scripts].map((s) => s.src).filter(Boolean),
  );
  for (const src of scripts) {
    const body = await (await page.request.get(src)).text();
    expect(body, src).not.toContain("rrweb");
  }
});
