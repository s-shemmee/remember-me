import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { AppearanceCard } from "@/features/account/components/appearance-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseThemeChoice } from "@/lib/theme";

export const metadata: Metadata = { title: "Appearance · Settings · Remember Me" };

/** The same choice as the theme toggle in page headers (this device first, then your profile). */
async function Appearance() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("theme").maybeSingle();
  return <AppearanceCard saved={parseThemeChoice(data?.theme)} />;
}

export default function AppearanceSettingsPage() {
  return (
    <Suspense fallback={<Card aria-busy="true" className="h-48" />}>
      <Appearance />
    </Suspense>
  );
}
