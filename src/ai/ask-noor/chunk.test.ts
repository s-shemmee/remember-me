import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { HELP_SLUGS } from "@/features/help/slugs";

import {
  chunkDoc,
  estimateTokens,
  hashText,
  MAX_TOKENS,
  OVERLAP_TOKENS,
  type SourceDoc,
} from "./chunk";
import { helpDoc } from "./sources";

const words = (n: number, word = "word") =>
  Array.from({ length: n }, (_, i) => `${word}${i}`).join(" ");
const doc = (sections: SourceDoc["sections"]): SourceDoc => ({
  source: "help/test",
  title: "Test article",
  url: "/help/test",
  sections,
});

describe("chunker", () => {
  it("merges small neighbouring sections up to about 500 tokens", () => {
    const chunks = chunkDoc(
      doc([
        { heading: "Test article", text: words(60) },
        { heading: "First", text: words(60) },
        { heading: "Second", text: words(60) },
      ]),
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.heading).toBe("Test article · First · Second");
    // Starts at the intro: links to the page itself (the title has no anchor).
    expect(chunks[0]!.url).toBe("/help/test");
  });

  it("splits a long section by paragraph, each part under the cap, with a small overlap", () => {
    const long = Array.from({ length: 12 }, (_, i) => words(70, `p${i}w`)).join("\n\n");
    const chunks = chunkDoc(doc([{ heading: "Long section", text: long }]));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks)
      expect(estimateTokens(c.content)).toBeLessThanOrEqual(MAX_TOKENS + OVERLAP_TOKENS + 20);
    // Each chunk after the first repeats the end of the one before.
    const lastWordsOfFirst = chunks[0]!.content.split(" ").slice(-3).join(" ");
    expect(chunks[1]!.content).toContain(lastWordsOfFirst);
    expect(chunks[1]!.url).toBe("/help/test#long-section");
  });

  it("keys are stable and hashes change only with the text", () => {
    const a = chunkDoc(doc([{ heading: "Choose when", text: "Reminders arrive at 9:00." }]));
    const b = chunkDoc(doc([{ heading: "Choose when", text: "Reminders arrive at 9:00." }]));
    const c = chunkDoc(doc([{ heading: "Choose when", text: "Reminders arrive at 10:00." }]));
    expect(a[0]!.key).toBe("help/test#choose-when#0");
    expect(a[0]!.hash).toBe(b[0]!.hash);
    expect(a[0]!.hash).not.toBe(c[0]!.hash);
    expect(hashText("x")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("skips empty sections, and the FAQ (already an anchor) keeps its URL", () => {
    const faq = chunkDoc({
      source: "faq",
      title: "Questions, answered",
      url: "/#faq",
      sections: [
        { heading: "Is it free?", text: "Yes." },
        { heading: "Empty", text: "   " },
      ],
    });
    expect(faq).toHaveLength(1);
    expect(faq[0]!.url).toBe("/#faq");
  });

  it("the real help articles become chunks of about 300–500 tokens", () => {
    const root = path.resolve(__dirname, "../../..");
    const chunks = HELP_SLUGS.flatMap((slug) =>
      chunkDoc(helpDoc(slug, readFileSync(path.join(root, "docs/help", `${slug}.md`), "utf8"))),
    );
    expect(chunks.length).toBeGreaterThanOrEqual(HELP_SLUGS.length);
    for (const c of chunks) {
      expect(estimateTokens(c.content), c.key).toBeLessThanOrEqual(
        MAX_TOKENS + OVERLAP_TOKENS + 20,
      );
      expect(c.url, c.key).toMatch(/^\/help\/[a-z-]+(#[a-z0-9-]+)?$/);
    }
    expect(new Set(chunks.map((c) => c.key)).size).toBe(chunks.length);
  });
});
