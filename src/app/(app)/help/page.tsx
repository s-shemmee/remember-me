import type { Metadata } from "next";

import { ComingSoon } from "@/features/shell/coming-soon";

export const metadata: Metadata = { title: "Help & feedback · Remember Me" };

// Placeholder until the help page exists.
export default function Page() {
  return (
    <ComingSoon
      title="Help & feedback"
      line="A proper help page is coming soon. I'd love to hear what you think 💬"
    />
  );
}
