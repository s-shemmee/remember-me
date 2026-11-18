import type { Metadata } from "next";
import { Suspense } from "react";
import { NO_INDEX } from "@/lib/seo";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignUpPanel, signUpPanelClass } from "@/features/auth/components/panels";
import { UnsubscribeForm } from "@/features/reminders/components/unsubscribe-form";
import { looksLikeUnsubscribeToken } from "@/features/reminders/unsubscribe-token";

export const metadata: Metadata = {
  title: "Unsubscribe · Remember Me",
  // A personal link: never indexed, never sent on as a referrer.
  robots: NO_INDEX,
  referrer: "no-referrer",
};

async function Unsubscribe({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <UnsubscribeForm token={looksLikeUnsubscribeToken(token) ? token : ""} />;
}

/** From the link in a reminder email: asks first, then turns reminder emails off. */
export default function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <AuthShell panel={<SignUpPanel />} panelClassName={signUpPanelClass}>
      <Suspense fallback={<div aria-busy="true" className="h-40" />}>
        <Unsubscribe searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
