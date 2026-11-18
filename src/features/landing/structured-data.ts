/**
 * Structured data for the landing page (schema.org, JSON-LD): the app as a
 * WebApplication, and the FAQ as an FAQPage built from the same FAQ list the
 * page shows. Pure, so it's unit-tested.
 */
import { FAQ, type Faq, SEO_DESCRIPTION, SITE_NAME } from "./content";

export function webApplication(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: `${siteUrl}/`,
    description: SEO_DESCRIPTION,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript. Installable as a web app.",
    inLanguage: "en",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

export function faqPage(siteUrl: string, faq: Faq[] = FAQ) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: `${siteUrl}/#faq`,
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/**
 * For a <script type="application/ld+json">: `<` is escaped so the content
 * can never close the script tag early.
 */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
