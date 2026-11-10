import type { Metadata } from "next";

import { ComingSoon } from "@/features/shell/coming-soon";

export const metadata: Metadata = { title: "Wishlists · Remember Me" };

// Placeholder until wishlists ship (M3).
export default function Page() {
  return (
    <ComingSoon
      title="Wishlists"
      line="Wishlists are on their way. Soon you'll share yours and peek at your people's 🎁"
    />
  );
}
