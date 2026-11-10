import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OnboardingFlow } from "@/features/onboarding/components/onboarding-flow";
import { onboardingRedirect } from "@/features/onboarding/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Getting started · Remember Me" };

/**
 * Onboarding (M1 part 2). The proxy only lets signed-in people here; this
 * sends anyone who already finished to /home, and prefills the first name
 * from sign-up or Google (profiles.first_name).
 */
async function OnboardingGate() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/log-in?next=%2Fonboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, onboarded_at")
    .eq("id", userId)
    .maybeSingle();

  const to = onboardingRedirect("/onboarding", Boolean(profile?.onboarded_at));
  if (to) redirect(to);

  return <OnboardingFlow userId={userId} initialFirstName={profile?.first_name ?? ""} />;
}

export default function OnboardingPage() {
  return (
    // Request data (session, profile) streams in; nothing to show before it.
    <Suspense fallback={<div aria-busy="true" className="min-h-dvh" />}>
      <OnboardingGate />
    </Suspense>
  );
}
