import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { type Block, type Inline, parseArticle } from "./markdown";
import { HELP_SLUGS } from "./slugs";

/**
 * The help articles (docs/help/*.md): every one parses, is listed, has a
 * title and a summary, follows the copy rules, and links only to real pages.
 * They describe built features only (the same files are Ask Noor's sources).
 */
const ROOT = path.resolve(__dirname, "../../..");
const DIR = path.join(ROOT, "docs/help");
const read = (slug: string) => parseArticle(readFileSync(path.join(DIR, `${slug}.md`), "utf8"));

const PUBLIC_ROUTES = new Set(["/", "/privacy", "/terms", "/help", "/log-in", "/sign-up"]);

function links(blocks: Block[]): string[] {
  const walk = (nodes: Inline[]): string[] =>
    nodes.flatMap((n) =>
      n.type === "link"
        ? [n.href, ...walk(n.children)]
        : n.type === "strong"
          ? walk(n.children)
          : [],
    );
  return blocks.flatMap((b) =>
    b.type === "paragraph" ? walk(b.children) : b.type === "list" ? b.items.flatMap(walk) : [],
  );
}

describe("help articles", () => {
  it("every file in docs/help is listed, and every listed slug has a file", () => {
    const files = readdirSync(DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""))
      .sort();
    expect(files).toEqual([...HELP_SLUGS].sort());
  });

  it.each(HELP_SLUGS)("%s: a title, a summary, at least two sections", (slug) => {
    const a = read(slug);
    expect(a.title.length).toBeGreaterThan(3);
    expect(a.description.length).toBeGreaterThan(40);
    expect(
      a.blocks.filter((b) => b.type === "heading" && b.level === 2).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it.each(HELP_SLUGS)("%s: plain copy (no em dashes) and links only to real pages", (slug) => {
    const source = readFileSync(path.join(DIR, `${slug}.md`), "utf8");
    expect(source).not.toMatch(/—/);
    for (const href of links(read(slug).blocks)) {
      if (href.startsWith("mailto:")) {
        expect(href).toBe("mailto:contact@shemme.codes");
      } else if (href.startsWith("/help/")) {
        expect(HELP_SLUGS, href).toContain(href.slice("/help/".length));
      } else {
        expect(PUBLIC_ROUTES.has(href.split("#")[0]!), href).toBe(true);
      }
    }
  });

  it("no unbuilt features (link previews, AI, Apple sign-in, memories beyond 'coming soon')", () => {
    const all = HELP_SLUGS.map((s) => readFileSync(path.join(DIR, `${s}.md`), "utf8")).join("\n");
    expect(all).not.toMatch(
      /link preview|artificial intelligence|\bAI\b|Apple sign|Sign in with Apple|Continue with Apple/i,
    );
    // Birthday memories may only be mentioned as not available yet.
    for (const line of all.split("\n").filter((l) => /memories/i.test(l))) {
      expect(line).toMatch(/Coming soon|aren't available yet/);
    }
    expect(existsSync(path.join(DIR, "README.md"))).toBe(false);
  });
});
