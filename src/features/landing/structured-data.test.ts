import { describe, expect, it } from "vitest";

import { FAQ } from "./content";
import { faqPage, jsonLd, webApplication } from "./structured-data";

const SITE = "https://app.example.com";

describe("structured data", () => {
  it("describes the app as a free WebApplication", () => {
    expect(webApplication(SITE)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Remember Me",
      url: `${SITE}/`,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0" },
    });
  });

  it("the FAQPage is built from the same FAQ the page shows", () => {
    const page = faqPage(SITE);
    expect(page["@type"]).toBe("FAQPage");
    expect(page.mainEntity).toHaveLength(FAQ.length);
    FAQ.forEach((f, i) => {
      expect(page.mainEntity[i]).toEqual({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      });
    });
  });

  it("the phone answer says what's true today", () => {
    expect(FAQ.find((f) => f.question === "Does it work on my phone?")?.answer).toBe(
      "You can install Remember Me on your phone today from the browser. Native Android and iPhone apps come later.",
    );
  });

  it("can never close its script tag early", () => {
    expect(jsonLd({ a: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
