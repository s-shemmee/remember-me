import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { DEFAULT_REMINDER_OFFSETS } from "@/features/onboarding/constants";
import { ReminderSettings } from "@/features/settings/components/reminder-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reminders · Settings · Remember Me" };

async function Reminders() {
  const supabase = await createSupabaseServerClient();
  const [{ data: claims }, { data: settings }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("reminder_settings").select("offsets_days, email").maybeSingle(),
  ]);
  const email = typeof claims?.claims?.email === "string" ? claims.claims.email : "your inbox";
  return (
    <ReminderSettings
      email={email}
      initial={{
        offsets: settings?.offsets_days ?? DEFAULT_REMINDER_OFFSETS,
        email: settings?.email ?? true,
      }}
    />
  );
}

export default function RemindersSettingsPage() {
  return (
    <Suspense fallback={<Card aria-busy="true" className="h-96" />}>
      <Reminders />
    </Suspense>
  );
}
