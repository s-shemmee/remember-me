import { describe, expect, it } from "vitest";

import { faqDoc, helpDoc, htmlToText, legalDoc } from "./sources";

describe("knowledge base sources", () => {
  it("a help article: the intro, then one section per ## heading", () => {
    const d = helpDoc(
      "reminders",
      "# Reminders\n\nNoor reminds you.\n\n## Choose when\n\n- 7 days before;\n- the morning of.\n\n## By email\n\nOn by default.",
    );
    expect(d).toMatchObject({
      source: "help/reminders",
      title: "Reminders",
      url: "/help/reminders",
    });
    expect(d.sections).toEqual([
      { heading: "Reminders", text: "Noor reminds you." },
      { heading: "Choose when", text: "- 7 days before;\n- the morning of." },
      { heading: "By email", text: "On by default." },
    ]);
  });

  it("HTML to text: tags out, entities decoded, lists kept readable", () => {
    expect(
      htmlToText(
        "<p>No <strong>tracking</strong> &amp; no ads.</p><ul><li>One</li><li>Two</li></ul>",
      ),
    ).toBe("No tracking & no ads.\n- One\n- Two");
    expect(htmlToText("<p>Don&#x27;t &ldquo;sell&rdquo;</p><script>evil()</script>")).toBe(
      "Don't “sell”",
    );
  });

  it("a legal page: the H2 sections inside <main>, without 'On this page' or the footer", () => {
    const html = `<header><h2>Ignored</h2></header><main>
      <h1>Privacy Policy</h1><nav><h2 id="on-this-page">On this page</h2><ol><li>What we keep</li></ol></nav>
      <section><h2 id="what-we-keep">What we keep</h2><p>Only what the app needs.</p></section>
      <section><h2 id="your-rights">Your rights</h2><p>See and take your data.</p></section>
    </main><footer><h2>Product</h2></footer>`;
    expect(legalDoc("privacy", "Privacy Policy", "/privacy", html).sections).toEqual([
      { heading: "What we keep", text: "Only what the app needs." },
      { heading: "Your rights", text: "See and take your data." },
    ]);
  });

  it("the FAQ, from the page's FAQPage JSON-LD", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is Remember Me free?",
          acceptedAnswer: { "@type": "Answer", text: "Yes." },
        },
      ],
    })}</script><script type="application/ld+json">{"@type":"WebApplication"}</script>`;
    expect(faqDoc(html)).toEqual({
      source: "faq",
      title: "Questions, answered",
      url: "/#faq",
      sections: [{ heading: "Is Remember Me free?", text: "Yes." }],
    });
  });
});
