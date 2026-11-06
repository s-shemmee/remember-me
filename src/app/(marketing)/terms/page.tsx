import type { Metadata } from "next";

import { LegalPlaceholder } from "../legal-placeholder";

export const metadata: Metadata = { title: "Terms · Remember Me", robots: { index: false } };

export default function TermsPage() {
  return (
    <LegalPlaceholder title="Terms">
      <p>Our full terms are being written and will be here before Remember Me opens to everyone.</p>
      <p>In short: it&apos;s free, your people&apos;s details are yours, and we never sell them.</p>
    </LegalPlaceholder>
  );
}
