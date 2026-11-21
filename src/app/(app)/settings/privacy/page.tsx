import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { DownloadDataCard } from "@/features/account/components/data-card";
import { PrivacyCard } from "@/features/profile/components/privacy-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Privacy · Settings · Remember Me" };

async function Privacy() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("share_birthday").maybeSingle();
  return <PrivacyCard shareBirthday={data?.share_birthday ?? true} />;
}

/** Who sees what (the birthday switch, the lists), and your data. */
export default function PrivacySettingsPage() {
  return (
    <>
      <Suspense fallback={<Card aria-busy="true" className="h-64" />}>
        <Privacy />
      </Suspense>
      <DownloadDataCard />
    </>
  );
}
