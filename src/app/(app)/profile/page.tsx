import type { Metadata } from "next";

import { ComingSoon } from "@/features/shell/coming-soon";

export const metadata: Metadata = { title: "My profile · Remember Me" };

// Placeholder until Profile ships (M3 and M5).
export default function Page() {
  return (
    <ComingSoon
      title="My profile"
      line="Your profile is coming soon, with your card and an invite link for your people."
    />
  );
}
