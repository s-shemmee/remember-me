/**
 * The small Markdown subset our help articles use (docs/help/*.md), parsed
 * into plain data so pages render it as React (never as HTML strings), and
 * the indexer can split it by heading. No dependency.
 *
 * Blocks: `# Title` (once, first), `## Heading`, `### Heading`, paragraphs,
 * `- ` lists and `1. ` lists. Inline: **bold**, [text](href), `code`, and bare
 * email addresses (linked as mailto:).
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; level: 2 | 3; text: string; id: string }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] };

export type Article = {
  title: string;
  /** The first paragraph, as plain text (meta description, index card). */
  description: string;
  blocks: Block[];
};

/** "Send an invite" → "send-an-invite". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const INLINE =
  /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "strong", children: parseInline(m[1]) });
    else if (m[2] !== undefined) out.push({ type: "code", text: m[2] });
    else if (m[3] !== undefined)
      out.push({ type: "link", href: m[4]!, children: parseInline(m[3]) });
    else
      out.push({ type: "link", href: `mailto:${m[5]}`, children: [{ type: "text", text: m[5]! }] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** Inline content as plain text (descriptions, chunk text). */
export function plainText(nodes: Inline[]): string {
  return nodes
    .map((n) => (n.type === "text" || n.type === "code" ? n.text : plainText(n.children)))
    .join("");
}

export function parseArticle(source: string): Article {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" ")) });
      paragraph = [];
    }
    if (list) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,3}) (.+)$/.exec(line);
    const ul = /^- (.+)$/.exec(line);
    const ol = /^\d+\. (.+)$/.exec(line);
    if (h) {
      flush();
      const level = h[1]!.length;
      if (level === 1) {
        if (title) throw new Error("A help article has one # title.");
        title = h[2]!.trim();
      } else {
        const text = h[2]!.trim();
        blocks.push({ type: "heading", level: level as 2 | 3, text, id: slugify(text) });
      }
    } else if (ul || ol) {
      if (paragraph.length) flush();
      const ordered = Boolean(ol);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((ul ?? ol)![1]!.trim());
    } else if (line.trim() === "") {
      flush();
    } else if (list && /^\s+\S/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      if (list) flush();
      paragraph.push(line.trim());
    }
  }
  flush();

  if (!title) throw new Error("A help article starts with a # title.");
  const first = blocks.find((b) => b.type === "paragraph");
  const description = first?.type === "paragraph" ? plainText(first.children) : "";
  return { title, description, blocks };
}
