/**
 * Ask Noor's knowledge base, split into chunks for embedding.
 *
 * A document is a list of sections (a heading and its text). Each section
 * becomes one chunk when it fits; a long section is split by paragraph into
 * chunks of about 300–500 tokens, each starting with a short overlap from the
 * one before, so an answer that spans the break still has its context.
 * Each chunk carries a stable key and a hash of its text: the indexer only
 * re-embeds chunks whose hash changed.
 *
 * Pure, no imports (shared by `pnpm ai:index`, the Edge Functions and Vitest).
 */
export type Section = { heading: string; text: string };
export type SourceDoc = {
  /** "help/reminders", "faq", "privacy", "terms". */
  source: string;
  title: string;
  /** The public page, e.g. "/help/reminders" (section anchors are added). */
  url: string;
  sections: Section[];
};
export type Chunk = {
  /** Stable: source + heading + part. */
  key: string;
  source: string;
  title: string;
  heading: string;
  /** Page + anchor, e.g. "/help/reminders#push-notifications". */
  url: string;
  content: string;
  hash: string;
};

/** A cheap token estimate (English: about 4 characters a token). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export const TARGET_TOKENS = 400;
export const MAX_TOKENS = 500;
export const MIN_TOKENS = 300;
export const OVERLAP_TOKENS = 50;

/** "Send an invite" → "send-an-invite" (matches the help pages' anchors). */
export function anchor(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** FNV-1a (two 32-bit passes, different seeds) as 16 hex characters: fast and stable, not for security. */
export function hashText(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const pass = (seed: number) => {
    let h = seed >>> 0;
    for (const byte of bytes) {
      h ^= byte;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return pass(0x811c9dc5) + pass(0x050c5d1f);
}

/** The last ~OVERLAP_TOKENS of a text, starting at a word. */
function tail(text: string): string {
  const chars = OVERLAP_TOKENS * 4;
  if (text.length <= chars) return text;
  const cut = text.slice(-chars);
  const space = cut.indexOf(" ");
  return space === -1 ? cut : cut.slice(space + 1);
}

/** Splits a long text into parts of at most MAX_TOKENS, by paragraph, then sentence. */
function splitLong(text: string): string[] {
  const pieces = text
    .split(/\n{2,}/)
    .flatMap((p) => (estimateTokens(p) > MAX_TOKENS ? p.split(/(?<=[.!?])\s+/) : [p]))
    .map((p) => p.trim())
    .filter(Boolean);
  const parts: string[] = [];
  let current = "";
  for (const piece of pieces) {
    const next = current ? `${current}\n\n${piece}` : piece;
    if (current && estimateTokens(next) > TARGET_TOKENS) {
      parts.push(current);
      current = `${tail(current)} ${piece}`;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export function chunkDoc(doc: SourceDoc): Chunk[] {
  // 1. Units: each section, or its parts when it's too long on its own.
  const units = doc.sections.flatMap((section) => {
    const body = section.text.trim();
    if (!body) return [];
    const parts = estimateTokens(body) > MAX_TOKENS ? splitLong(body) : [body];
    return parts.map((text) => ({ heading: section.heading, text }));
  });

  // 2. Merge neighbouring units up to MAX_TOKENS, so chunks land around 300–500.
  const groups: { headings: string[]; text: string }[] = [];
  let current: { headings: string[]; text: string } | null = null;
  for (const unit of units) {
    const piece = `${unit.heading}\n${unit.text}`;
    if (current && estimateTokens(`${current.text}\n\n${piece}`) <= MAX_TOKENS) {
      if (!current.headings.includes(unit.heading)) current.headings.push(unit.heading);
      current.text = `${current.text}\n\n${piece}`;
    } else {
      if (current) groups.push(current);
      current = { headings: [unit.heading], text: piece };
    }
  }
  if (current) groups.push(current);

  // 3. Each chunk starts with a little of the one before (same document).
  return groups.map((group, i) => {
    const first = group.headings[0]!;
    // The intro's heading is the page title: it has no anchor on the page.
    const id = first === doc.title ? "" : anchor(first);
    const overlap = i > 0 ? `…${tail(groups[i - 1]!.text)}\n\n` : "";
    const content = `${doc.title}\n\n${overlap}${group.text}`;
    return {
      key: `${doc.source}#${id || "intro"}#${i}`,
      source: doc.source,
      title: doc.title,
      heading: group.headings.join(" · "),
      // Pages that are already an anchor (the FAQ, /#faq) keep their URL.
      url: id && !doc.url.includes("#") ? `${doc.url}#${id}` : doc.url,
      content,
      hash: hashText(content),
    };
  });
}
