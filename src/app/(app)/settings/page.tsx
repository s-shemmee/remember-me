import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { NoorBubble } from "@/components/ui/noor-bubble";
import { InstallCard } from "@/features/notifications/components/install-card";
import {
  type Device,
  NotificationsCard,
} from "@/features/notifications/components/notifications-card";
import { dayLabel } from "@/features/notifications/messages";
import { DEFAULT_REMINDER_OFFSETS } from "@/features/onboarding/constants";
import { ReminderSettings } from "@/features/settings/components/reminder-settings";
import { AppMain } from "@/features/shell/app-shell";
import { addDays, todayIn, toIsoDate } from "@/lib/dates";
import { getEnv } from "@/lib/env";
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

/** Your devices for push (RLS: your own), with dates in your timezone. */
async function Notifications() {
  const supabase = await createSupabaseServerClient();
  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase
      .from("push_subscriptions")
      .select("id, device_label, endpoint, created_at, last_used_at")
      .order("created_at"),
    supabase.from("profiles").select("timezone").maybeSingle(),
  ]);
  const zone = profile?.timezone ?? undefined;
  const today = todayIn(zone);
  const isoToday = toIsoDate(today);
  const isoYesterday = toIsoDate(addDays(today, -1));
  const localDay = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: zone || "Africa/Casablanca",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(iso))
      : null;
  const devices: Device[] = (rows ?? []).map((r) => {
    const added = dayLabel(localDay(r.created_at), isoToday, isoYesterday);
    const used = dayLabel(localDay(r.last_used_at), isoToday, isoYesterday);
    return {
      id: r.id,
      label: r.device_label,
      endpoint: r.endpoint,
      line: `Added ${added}${used ? ` · Last used ${used}` : " · Not used yet"}`,
    };
  });
  return (
    <NotificationsCard devices={devices} vapidKey={getEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
  );
}

/** Settings (AppSettings): Reminders, Notifications and App; the rest come in M5. */
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
        <Suspense fallback={<Card aria-busy="true" className="h-64" />}>
          <Notifications />
        </Suspense>
        <InstallCard />
        <section
          aria-labelledby="more-settings"
          className="flex flex-col gap-4 rounded-card-lg bg-card p-6 shadow-card sm:p-8"
        >
          <h2 id="more-settings" className="text-22 font-extrabold tracking-[-0.02em]">
            More settings
          </h2>
          <NoorBubble className="[&_p]:bg-card2 [&_p]:shadow-none">
            Privacy, appearance and your account are coming soon 💛
          </NoorBubble>
        </section>
      </div>
    </AppMain>
  );
}
