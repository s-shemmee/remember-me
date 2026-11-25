import { expect, type Page, test } from "@playwright/test";

import { expectAccessible } from "./helpers";

/**
 * M6 part 2: the Privacy Policy and Terms. They render with a last-updated
 * date and their sections, they're linked from the landing footer, sign-up
 * and log-in, they're in the sitemap, and axe passes in light and dark at
 * 390 and 1440.
 */
const PAGES = [
  {
    path: "/privacy",
    heading: /Privacy\s+Policy/,
    sections: [
      "What we keep",
      "The people you add",
      "What your connections see",
      "Who helps us run it",
      "Cookies and storage",
      "How long we keep it",
      "Your rights",
    ],
  },
  {
    path: "/terms",
    heading: /Terms of\s+use/,
    sections: [
      "The service",
      "Who can use it",
      "Your content",
      "Be kind",
      "Leaving",
      "No guarantees",
    ],
  },
] as const;

async function main(page: Page) {
  return page.getByRole("main");
}

for (const p of PAGES) {
  test(`${p.path}: real content, last updated, sections and in-page links`, async ({ page }) => {
    await page.goto(p.path);
    const m = await main(page);
    await expect(m.getByRole("heading", { level: 1, name: p.heading })).toBeVisible();
    await expect(m.getByText(/^Last updated \d{1,2} \w+ 20\d\d$/)).toBeVisible();
    await expect(page.getByText(/coming soon|being written/i)).toHaveCount(0);
    const toc = m.getByRole("navigation", { name: "On this page" });
    for (const name of p.sections) {
      await expect(m.getByRole("heading", { level: 2, name })).toBeVisible();
      await expect(toc.getByRole("link", { name })).toBeVisible();
    }
    // An in-page link lands on its section.
    await toc.getByRole("link", { name: p.sections[1] }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `#${await m.getByRole("heading", { level: 2, name: p.sections[1] }).getAttribute("id")}$`,
      ),
    );
    const contactLink = m.locator('a[href^="mailto:"]').first();
    await expect(contactLink).toHaveAttribute("href", /^mailto:/);
    await expect(contactLink).toContainText("@");
    // Indexable (no noindex).
    const robots = await page.evaluate(
      () => document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "",
    );
    expect(robots).not.toMatch(/noindex/);
  });
}

test("the privacy policy explains deployment-dependent services and promises no tracking", async ({
  page,
}) => {
  await page.goto("/privacy");
  const m = await main(page);
  for (const text of [
    "operator of each instance is responsible",
    "This source code does not define a universal hosting region or provider",
    "No tracking cookies, no ads.",
    "Anonymous page counts (deployment-dependent).",
    "Global Privacy Control and Do Not Track",
    "Privacy laws may provide additional rights",
    "data protection authority responsible for your location",
  ]) {
    await expect(m.getByText(text, { exact: false }).first()).toBeVisible();
  }
  await expect(m.getByText(/link preview/i)).toHaveCount(0);
});

test("linked from the landing footer, sign-up, log-in, and the sitemap", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const footer = page.getByRole("navigation", { name: "Footer" });
  await footer.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page
    .getByRole("navigation", { name: "Footer" })
    .getByRole("link", { name: "Terms" })
    .click();
  await expect(page).toHaveURL(/\/terms$/);

  // One consent line per auth page, last.
  await page.goto("/sign-up");
  const consent = page.getByText("By continuing, you agree to our").filter({ visible: true });
  await expect(consent).toHaveCount(1);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await consent.getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);

  await page.goto("/log-in");
  const logInConsent = page.getByText("By continuing, you agree to our").filter({ visible: true });
  await expect(logInConsent).toHaveCount(1);
  await logInConsent.getByRole("link", { name: "Terms" }).click();
  await expect(page).toHaveURL(/\/terms$/);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toMatch(/<loc>[^<]*\/privacy<\/loc>/);
  expect(sitemap).toMatch(/<loc>[^<]*\/terms<\/loc>/);
});

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`axe: privacy and terms at ${width}, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((t) => localStorage.setItem("rm-theme", t), theme);
      await page.setViewportSize({ width, height: 900 });
      for (const p of PAGES) {
        await page.goto(p.path);
        await expectAccessible(page, `${p.path} ${width} ${theme}`);
        // No sideways scrolling.
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
      }
    });
  }
}
