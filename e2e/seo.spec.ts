import { expect, test } from "@playwright/test";

/**
 * SEO and accessibility basics on every public page:
 * - exactly one H1, and no skipped heading levels (an H2 before any H3…);
 * - every <img> has an alt (meaningful, or "" when decorative and hidden);
 *   every visible SVG is hidden or labelled;
 * - no console errors on the key pages (/, /privacy, /terms, /log-in, /sign-up).
 */
const PUBLIC_PAGES = [
  "/",
  "/privacy",
  "/terms",
  "/log-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/check-email",
  "/offline",
  "/invite/not-a-real-invite",
  "/unsubscribe",
  "/help",
  "/help/getting-started",
];

test("one H1 per public page, no skipped heading levels, images and icons labelled", async ({
  page,
}) => {
  const problems: string[] = [];
  for (const path of PUBLIC_PAGES) {
    await page.goto(path);
    // Some pages stream their content (invite, unsubscribe): wait for it.
    await page.waitForLoadState("networkidle");
    const report = await page.evaluate(() => {
      const visible = (el: Element) => !el.closest("[hidden],[aria-hidden=true],template");
      const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
        .filter(visible)
        .map((h) => ({
          level: Number(h.tagName[1]),
          text: (h.textContent ?? "").trim().slice(0, 40),
        }));
      const imgs = [...document.querySelectorAll("img")].map((i) => ({
        src: (i.getAttribute("src") ?? "").slice(0, 60),
        alt: i.getAttribute("alt"),
      }));
      const unlabelledSvgs = [...document.querySelectorAll("svg")].filter(
        (s) =>
          visible(s) &&
          s.getAttribute("aria-hidden") !== "true" &&
          !s.closest("[role=img],[aria-label],a[aria-label],button[aria-label]") &&
          !(
            s.getAttribute("role") === "img" &&
            (s.getAttribute("aria-label") || s.querySelector("title"))
          ),
      ).length;
      return { levels, imgs, unlabelledSvgs };
    });

    const h1s = report.levels.filter((h) => h.level === 1);
    if (h1s.length !== 1) problems.push(`${path}: ${h1s.length} H1s`);
    if (report.levels[0]?.level !== 1) problems.push(`${path}: the first heading isn't the H1`);
    report.levels.forEach((h, i) => {
      const prev = report.levels[i - 1];
      if (prev && h.level > prev.level + 1) {
        problems.push(
          `${path}: H${prev.level} "${prev.text}" is followed by H${h.level} "${h.text}"`,
        );
      }
    });
    for (const img of report.imgs) {
      if (img.alt === null) problems.push(`${path}: <img ${img.src}> has no alt`);
    }
    if (report.unlabelledSvgs) problems.push(`${path}: ${report.unlabelledSvgs} unlabelled SVGs`);
  }
  expect(problems).toEqual([]);
});

for (const path of ["/", "/privacy", "/terms", "/log-in", "/sign-up"]) {
  test(`no console errors on ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(`uncaught: ${e.message}`));
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    // A little interaction, as a visitor would: scroll to the end and back.
    await page.mouse.wheel(0, 20_000);
    await page.waitForTimeout(500);
    await page.mouse.wheel(0, -20_000);
    expect(errors).toEqual([]);
  });
}
