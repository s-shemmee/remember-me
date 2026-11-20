/**
 * The documents Ask Noor answers from, turned into sections for chunk.ts:
 * - the help articles (docs/help/*.md), via the same parser as /help;
 * - the landing page's FAQ, from its FAQPage JSON-LD (the same data as the
 *   visible FAQ: src/features/landing/content.ts feeds both);
 * - /privacy and /terms, from the rendered pages (their H2 sections), so the
 *   knowledge base always matches what people read.
 *
 * Pure (relative `.ts` imports only): used by `pnpm ai:index` and Vitest.
 */
import { type Block, parseArticle, plainText } from "../../features/help/markdown.ts";
import type { Section, SourceDoc } from "./chunk.ts";

function blockText(b: Block): string {
  if (b.type === "paragraph") return plainText(b.children);
  if (b.type === "list") return b.items.map((item) => `- ${plainText(item)}`).join("\n");
  return "";
}

/** A help article: its intro, then one section per ## heading (### stay inside). */
export function helpDoc(slug: string, markdown: string): SourceDoc {
  const a = parseArticle(markdown);
  const sections: Section[] = [];
  let current: Section = { heading: a.title, text: "" };
  for (const b of a.blocks) {
    if (b.type === "heading" && b.level === 2) {
      sections.push(current);
      current = { heading: b.text, text: "" };
    } else {
      const text = b.type === "heading" ? b.text : blockText(b);
      current.text = current.text ? `${current.text}\n\n${text}` : text;
    }
  }
  sections.push(current);
  return {
    source: `help/${slug}`,
    title: a.title,
    url: `/help/${slug}`,
    sections: sections.filter((s) => s.text.trim()),
  };
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  hellip: "…",
};

/** HTML to plain text: tags out, block ends as line breaks, entities decoded. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|svg|template)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|li|div|h[1-6]|ul|ol|section)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .replace(/ *\n */g, "\n")
    .trim();
}

/**
 * A legal page (/privacy, /terms): the H2 sections inside <main>, without the
 * "On this page" list. Headings are the visible text; anchors are their ids.
 */
export function legalDoc(
  source: "privacy" | "terms",
  title: string,
  url: string,
  html: string,
): SourceDoc {
  const main = /<main[\s\S]*?<\/main>/i.exec(html)?.[0] ?? "";
  const parts = main.split(/(?=<h2\b)/i).slice(1);
  const sections: Section[] = [];
  for (const part of parts) {
    const h = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(part);
    if (!h) continue;
    const heading = htmlToText(h[1]!);
    if (/^on this page$/i.test(heading)) continue;
    const text = htmlToText(part.slice(h.index + h[0].length));
    if (text) sections.push({ heading, text });
  }
  return { source, title, url, sections };
}

type JsonLd = { "@type"?: string | string[]; mainEntity?: unknown; "@graph"?: unknown[] };

/** The landing FAQ, from the page's FAQPage JSON-LD: one section per question. */
export function faqDoc(html: string): SourceDoc {
  const blocks = [
    ...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi),
  ];
  const items: { question: string; answer: string }[] = [];
  for (const [, raw] of blocks) {
    let data: JsonLd | JsonLd[];
    try {
      data = JSON.parse(raw!) as JsonLd | JsonLd[];
    } catch {
      continue;
    }
    const nodes = (Array.isArray(data) ? data : [data]).flatMap((d) =>
      d["@graph"] ? (d["@graph"] as JsonLd[]) : [d],
    );
    for (const node of nodes) {
      const type = node["@type"];
      if (!(type === "FAQPage" || (Array.isArray(type) && type.includes("FAQPage")))) continue;
      for (const q of (node.mainEntity as {
        name?: string;
        acceptedAnswer?: { text?: string };
      }[]) ?? []) {
        if (q.name && q.acceptedAnswer?.text) {
          items.push({ question: q.name, answer: htmlToText(q.acceptedAnswer.text) });
        }
      }
    }
  }
  return {
    source: "faq",
    title: "Questions, answered",
    url: "/#faq",
    sections: items.map((i) => ({ heading: i.question, text: i.answer })),
  };
}
