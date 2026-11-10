import { redirect } from "next/navigation";
import { Suspense } from "react";

import { onboardingRedirect } from "@/features/onboarding/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Every app page (home, people, calendar…) needs a finished onboarding.
 * The proxy has already checked the session; this checks onboarded_at with
 * one lookup by primary key and sends unfinished people to /onboarding.
 */
async function OnboardedGate({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/log-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", userId)
    .maybeSingle();

  const to = onboardingRedirect("/home", Boolean(profile?.onboarded_at));
  if (to) redirect(to);
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-dvh" />}>
      <OnboardedGate>{children}</OnboardedGate>
    </Suspense>
  );
}
