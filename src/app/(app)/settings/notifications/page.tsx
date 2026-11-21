import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { InstallCard } from "@/features/notifications/components/install-card";
import {
  type Device,
  NotificationsCard,
} from "@/features/notifications/components/notifications-card";
import { dayLabel } from "@/features/notifications/messages";
import { addDays, todayIn, toIsoDate } from "@/lib/dates";
import { getEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications · Settings · Remember Me" };

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

export default function NotificationsSettingsPage() {
  return (
    <>
      <Suspense fallback={<Card aria-busy="true" className="h-64" />}>
        <Notifications />
      </Suspense>
      <InstallCard />
    </>
  );
}
