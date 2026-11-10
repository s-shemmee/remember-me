import type { Metadata } from "next";

import { ComingSoon } from "@/features/shell/coming-soon";

export const metadata: Metadata = { title: "Settings · Remember Me" };

// Placeholder until Settings ship (M5).
export default function Page() {
  return (
    <ComingSoon
      title="Settings"
      line="Settings are coming soon. Until then I'll keep your reminders as you picked them."
    />
  );
}
