import type { Metadata } from "next";

import { LandingFooter, LandingHeader } from "@/features/landing/components/chrome";
import { Features } from "@/features/landing/components/features";
import { Hero } from "@/features/landing/components/hero";
import { Faq, FinalCta, HowItWorks, MeetNoor } from "@/features/landing/components/sections";
import { SEO_DESCRIPTION, SEO_TITLE, SITE_NAME } from "@/features/landing/content";
import { faqPage, jsonLd, webApplication } from "@/features/landing/structured-data";
import { siteUrl } from "@/lib/env";

/**
 * The landing page is fully static,
 * prerendered at build time. Signed-in visitors never see it: the proxy sends
 * them to /home. The Open Graph image is ./opengraph-image.tsx.
 */
export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    locale: "en",
  },
  twitter: { card: "summary_large_image", title: SEO_TITLE, description: SEO_DESCRIPTION },
};

export default function LandingPage() {
  const url = siteUrl();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(webApplication(url)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqPage(url)) }}
      />
      <LandingHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Features />
        <HowItWorks />
        <MeetNoor />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
