import type { Metadata } from "next";

import { LegalPlaceholder } from "../legal-placeholder";

export const metadata: Metadata = {
  title: "Privacy Policy · Remember Me",
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <LegalPlaceholder title="Privacy Policy">
      <p>
        Our full privacy policy is being written and will be here before Remember Me opens to
        everyone.
      </p>
      <p>
        In short: we keep only what the app needs, it stays private to you unless you choose to
        share, and you can export or delete everything.
      </p>
    </LegalPlaceholder>
  );
}
