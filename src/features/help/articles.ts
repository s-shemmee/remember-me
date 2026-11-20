import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { type Article, parseArticle } from "./markdown";
import { HELP_SLUGS, type HelpSlug } from "./slugs";

/**
 * The help articles from docs/help/*.md, read at build time (the pages are
 * static). The same files are the knowledge base Ask Noor answers from.
 */
const DIR = path.join(process.cwd(), "docs", "help");

export type HelpArticle = Article & { slug: HelpSlug };

export function getHelpArticle(slug: HelpSlug): HelpArticle {
  const source = readFileSync(path.join(DIR, `${slug}.md`), "utf8");
  return { slug, ...parseArticle(source) };
}

export function getHelpArticles(): HelpArticle[] {
  return HELP_SLUGS.map(getHelpArticle);
}
