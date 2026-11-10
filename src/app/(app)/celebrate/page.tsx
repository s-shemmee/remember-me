import type { Metadata } from "next";

import { ComingSoon } from "@/features/shell/coming-soon";

export const metadata: Metadata = { title: "Celebrate Me · Remember Me" };

// Placeholder until Celebrate Me ships (M5).
export default function Page() {
  return (
    <ComingSoon
      title="Celebrate Me"
      line="Your own day deserves a plan too. I'm getting it ready 🕯️"
    />
  );
}
