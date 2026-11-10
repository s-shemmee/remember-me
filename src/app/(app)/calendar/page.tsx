import type { Metadata } from "next";

import { ComingSoon } from "@/features/shell/coming-soon";

export const metadata: Metadata = { title: "Calendar · Remember Me" };

// Placeholder until the Calendar ships (M2).
export default function Page() {
  return (
    <ComingSoon
      title="Calendar"
      line="I'm still putting the calendar together. It's coming soon 🗓️"
    />
  );
}
