import { describe, expect, it } from "vitest";

import { parseArticle, parseInline, plainText, slugify } from "./markdown";

describe("help Markdown subset", () => {
  it("parses a title, the first paragraph as description, headings, lists and paragraphs", () => {
    const a = parseArticle(
      [
        "# Getting started",
        "",
        "Remember Me helps you",
        "remember people.",
        "",
        "## Create your account",
        "",
        "- one",
        "- **two** things",
        "",
        "1. first",
        "2. second",
        "",
        "### Small heading",
        "Last words.",
      ].join("\n"),
    );
    expect(a.title).toBe("Getting started");
    expect(a.description).toBe("Remember Me helps you remember people.");
    expect(a.blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "heading",
      "list",
      "list",
      "heading",
      "paragraph",
    ]);
    expect(a.blocks[1]).toEqual({
      type: "heading",
      level: 2,
      text: "Create your account",
      id: "create-your-account",
    });
    expect(a.blocks[2]).toMatchObject({ type: "list", ordered: false });
    expect(a.blocks[3]).toMatchObject({ type: "list", ordered: true });
  });

  it("inline: bold, code, links and bare emails (as mailto:)", () => {
    expect(
      parseInline(
        "Tap **Add someone**, see [Reminders](/help/reminders) or write to contact@shemme.codes.",
      ),
    ).toEqual([
      { type: "text", text: "Tap " },
      { type: "strong", children: [{ type: "text", text: "Add someone" }] },
      { type: "text", text: ", see " },
      { type: "link", href: "/help/reminders", children: [{ type: "text", text: "Reminders" }] },
      { type: "text", text: " or write to " },
      {
        type: "link",
        href: "mailto:contact@shemme.codes",
        children: [{ type: "text", text: "contact@shemme.codes" }],
      },
      { type: "text", text: "." },
    ]);
    expect(plainText(parseInline("Use `rm-theme` and **bold [x](/y)**"))).toBe(
      "Use rm-theme and bold x",
    );
  });

  it("refuses an article without exactly one title", () => {
    expect(() => parseArticle("Just text.")).toThrow(/title/);
    expect(() => parseArticle("# One\n\n# Two")).toThrow(/one # title/);
  });

  it("slugs headings for anchors", () => {
    expect(slugify("Send an invite")).toBe("send-an-invite");
    expect(slugify("Light, dark or system")).toBe("light-dark-or-system");
    expect(slugify("Help & feedback")).toBe("help-feedback");
  });
});
