import type { Metadata } from "next";

import { NO_INDEX } from "@/lib/seo";

/** Log in, sign up, password and onboarding pages: never in search results. */
export const metadata: Metadata = { robots: NO_INDEX };

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return children;
}
