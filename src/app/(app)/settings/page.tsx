import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { NoorBubble } from "@/components/ui/noor-bubble";
import { DEFAULT_REMINDER_OFFSETS } from "@/features/onboarding/constants";
import { ReminderSettings } from "@/features/settings/components/reminder-settings";
import { AppMain } from "@/features/shell/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings · Remember Me" };

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

/** Settings (AppSettings): Reminders now; the other sections come in M5. */
export default function SettingsPage() {
  return (
    <AppMain>
      <div className="flex flex-col gap-1">
        <h1 className="text-34 leading-tight font-extrabold tracking-heading">Settings</h1>
        <p className="text-15 text-sub">Saved automatically as you go</p>
      </div>
      <div className="grid max-w-3xl gap-6">
        <Suspense fallback={<Card aria-busy="true" className="h-96" />}>
          <Reminders />
        </Suspense>
        <section
          aria-labelledby="more-settings"
          className="flex flex-col gap-4 rounded-card-lg bg-card p-6 shadow-card sm:p-8"
        >
          <h2 id="more-settings" className="text-22 font-extrabold tracking-[-0.02em]">
            More settings
          </h2>
          <NoorBubble className="[&_p]:bg-card2 [&_p]:shadow-none">
            Notifications, privacy, appearance and your account are coming soon 💛
          </NoorBubble>
        </section>
      </div>
    </AppMain>
  );
}
