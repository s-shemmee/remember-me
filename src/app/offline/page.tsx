import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { NoorBubble } from "@/components/ui/noor-bubble";

export const metadata: Metadata = {
  title: "Offline · Remember Me",
  robots: NO_INDEX,
};

/**
 * Shown by the service worker when a page can't load offline. Static and
 * precached: no personal data, no session.
 */
export default function OfflinePage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-full flex-1 flex-col items-center justify-center gap-8 px-4 py-12 outline-none"
    >
      <Logo href={null} label="Remember me" />
      <div className="flex max-w-md flex-col items-center gap-6 rounded-card-lg bg-card p-6 text-center shadow-card sm:p-8">
        <h1 className="text-34 leading-tight font-extrabold tracking-heading">
          No connection right now
        </h1>
        <NoorBubble className="[&_p]:bg-card2 [&_p]:text-left [&_p]:shadow-none">
          You&apos;re offline. I&apos;ll be here when you&apos;re back 🕯️
        </NoorBubble>
        <p className="text-15 text-sub">
          Your people and wishlists aren&apos;t kept on this device, so they need a connection.
        </p>
        {/* A full page load, not a client navigation: that's the retry. */}
        <Button asChild>
          <a href="/home">Try again</a>
        </Button>
      </div>
    </main>
  );
}
