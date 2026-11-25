import { expect, type Page, test } from "@playwright/test";

/**
 * Broken-link check (CI's e2e job): crawls every public page, the sitemap and
 * /llms.txt, and fails on any link that answers 4xx or 5xx, any in-page
 * anchor without its target, and any internal page we can't reach.
 *
 * - Internal links are fetched from this build (canonical and llms.txt links
 *   are checked as paths here).
 * - App pages behind log-in only need to answer (a redirect to /log-in is fine).
 * - External links are fetched for real (3 tries). A 4xx/5xx answer fails;
 *   a site that never answers from the CI runner (cndp.ma times out from
 *   GitHub's data centres) is reported as a warning on the test, not a failure.
 * - mailto: must be our contact address.
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
];
const SITE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const UA = "Mozilla/5.0 (compatible; RememberMeLinkCheck/1.0)";

type Found = { href: string; from: string };

/** Every link-like thing on a page: anchors, icons, the manifest, canonical. */
async function linksOn(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...[...document.querySelectorAll<HTMLAnchorElement>("a[href]")].map((a) =>
      a.getAttribute("href")!,
    ),
    ...[...document.querySelectorAll<HTMLLinkElement>("link[href]")]
      .filter((l) => /icon|manifest|canonical/.test(l.rel))
      .map((l) => l.getAttribute("href")!),
  ]);
}

test("no broken links on the public pages, the sitemap or llms.txt", async ({
  page,
  request,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const base = new URL(baseURL!);
  const toLocal = (u: URL) => new URL(u.pathname + u.search + u.hash, base);
  const problems: string[] = [];
  const found: Found[] = [];

  // Seeds: the public pages, everything in the sitemap, and llms.txt's links.
  const seeds = new Set(PUBLIC_PAGES);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status(), "/sitemap.xml").toBe(200);
  for (const [, loc] of (await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)) {
    seeds.add(new URL(loc!).pathname);
  }
  const llms = await request.get("/llms.txt");
  expect(llms.status(), "/llms.txt").toBe(200);
  for (const [, href] of (await llms.text()).matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
    found.push({ href: href!, from: "/llms.txt" });
  }

  // Crawl: public pages and the internal pages they link to (no log-in needed).
  const queue = [...seeds];
  const visited = new Set<string>();
  const anchorsOn = new Map<string, Set<string>>();
  while (queue.length && visited.size < 40) {
    const path = queue.shift()!;
    if (visited.has(path)) continue;
    visited.add(path);
    const res = await page.goto(path);
    const status = res?.status() ?? 0;
    if (status >= 400) {
      problems.push(`${path}: page answered ${status}`);
      continue;
    }
    const landed = new URL(page.url()).pathname;
    if (landed !== path) continue; // redirected (e.g. to /log-in): fine, not a public page
    anchorsOn.set(
      path,
      new Set(await page.evaluate(() => [...document.querySelectorAll("[id]")].map((e) => e.id))),
    );
    for (const href of await linksOn(page)) {
      found.push({ href, from: path });
      const u = new URL(href, new URL(path, base));
      if (SITE_HOSTS.has(u.hostname) && !visited.has(u.pathname) && !/\.\w+$/.test(u.pathname)) {
        queue.push(u.pathname);
      }
    }
  }

  // Check every link once.
  const checked = new Map<string, string | null>();
  const external = async (url: string) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await request.get(url, {
          headers: { "User-Agent": UA },
          timeout: 15_000,
          maxRedirects: 10,
        });
        if (r.status() < 400) return null;
        if (attempt === 2) return `answered ${r.status()}`;
      } catch (e) {
        if (attempt === 2) {
          // No answer at all (timeout, DNS, refused): not a 4xx/5xx, so a warning.
          test.info().annotations.push({
            type: "warning",
            description: `${url} didn't answer from here (${String(e).slice(0, 80)})`,
          });
          console.warn(`links: ${url} didn't answer from here`);
          return null;
        }
      }
    }
    return null;
  };
  for (const { href, from } of found) {
    if (href.startsWith("mailto:")) {
      if (href !== "mailto:contact@shemme.codes") problems.push(`${from}: unexpected ${href}`);
      continue;
    }
    if (href.startsWith("tel:") || href.startsWith("javascript:")) {
      problems.push(`${from}: ${href} isn't a real link`);
      continue;
    }
    const u = new URL(href, new URL(from, base));
    if (!SITE_HOSTS.has(u.hostname)) {
      const key = u.href.split("#")[0]!;
      if (!checked.has(key)) checked.set(key, await external(key));
      const err = checked.get(key);
      if (err) problems.push(`${from} → ${key}: ${err}`);
      continue;
    }
    const local = toLocal(u);
    const key = local.pathname + local.search;
    if (!checked.has(key)) {
      const r = await request.get(key, { maxRedirects: 10 });
      checked.set(key, r.status() >= 400 ? `answered ${r.status()}` : null);
    }
    const err = checked.get(key);
    if (err) problems.push(`${from} → ${key}: ${err}`);
    // In-page anchors must exist (on public pages we visited).
    if (local.hash && anchorsOn.has(local.pathname)) {
      const id = decodeURIComponent(local.hash.slice(1));
      if (!anchorsOn.get(local.pathname)!.has(id))
        problems.push(`${from} → ${href}: no #${id} on ${local.pathname}`);
    }
  }

  expect(visited.size, "pages crawled").toBeGreaterThanOrEqual(PUBLIC_PAGES.length);
  expect(checked.size, "links checked").toBeGreaterThanOrEqual(10);
  expect(problems).toEqual([]);
});
