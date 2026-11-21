import type { Metadata } from "next";

import { DesktopSettingsRedirect, SettingsList } from "@/features/settings/components/settings-nav";

export const metadata: Metadata = { title: "Settings · Remember Me" };

/** Phones: the five sections as a list. Desktop: straight to Reminders. */
export default function SettingsPage() {
  return (
    <>
      <SettingsList />
      <DesktopSettingsRedirect />
    </>
  );
}
