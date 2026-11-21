import { connection } from "next/server";
import { Suspense } from "react";

import { SettingsHeader } from "@/features/settings/components/settings-nav";
import { AppMain } from "@/features/shell/app-shell";
import { PageHeaderFallback } from "@/features/shell/page-header";
import { notificationsInboxEnabled } from "@/lib/flags";

/** The bell switch is read per request. */
async function Header() {
  await connection();
  return <SettingsHeader bell={notificationsInboxEnabled()} />;
}

/**
 * Settings (AppSettings): one section at a time, each its own page
 * (/settings/reminders, …/notifications, …/privacy, …/appearance,
 * …/account). Desktop: a pill tab bar under the title, no second sidebar.
 * Phones: /settings is the grouped list; each section has a back button.
 * Everything still saves as you go.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppMain>
      <Suspense fallback={<PageHeaderFallback title="Settings" />}>
        <Header />
      </Suspense>
      <div className="grid max-w-3xl gap-5">{children}</div>
    </AppMain>
  );
}
