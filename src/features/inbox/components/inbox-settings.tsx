"use client";

import { InboxIcon } from "lucide-react";
import * as React from "react";

import { Switch } from "@/components/ui/switch";

import { setWishlistUpdates } from "../actions";

/**
 * Settings → Notifications → In the app: which notifications the bell
 * collects. Reminders and accepted invites always come; wishlist updates
 * from your people can be turned off (on by default).
 */
export function InboxSettingsCard({ wishlistUpdates }: { wishlistUpdates: boolean }) {
  const [on, setOn] = React.useState(wishlistUpdates);
  const [status, setStatus] = React.useState("");

  const change = async (next: boolean) => {
    setOn(next);
    const result = await setWishlistUpdates(next);
    if (!result.ok) {
      setOn(!next);
      setStatus("That didn't save. Please try again.");
      return;
    }
    setStatus("Saved");
  };

  return (
    <section
      aria-labelledby="inbox-settings-title"
      className="flex flex-col gap-4 rounded-card-lg bg-card p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="inbox-settings-title"
          className="flex items-center gap-2 text-22 font-extrabold tracking-[-0.02em]"
        >
          <InboxIcon aria-hidden className="size-5 text-accent-text" />
          In the app
        </h2>
        <p className="text-15 text-sub">
          The bell collects your reminders and accepted invites for 30 days.
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-[16px] bg-card2 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor="inbox-wishlist-updates" className="text-15 font-bold">
            Wishlist updates from my people
          </label>
          <span id="inbox-wishlist-updates-hint" className="text-13 text-sub">
            When someone you&apos;re connected with adds wishes to their birthday list.
          </span>
        </div>
        <Switch
          id="inbox-wishlist-updates"
          aria-describedby="inbox-wishlist-updates-hint"
          checked={on}
          onCheckedChange={(next) => void change(next)}
        />
      </div>
      <p role="status" aria-live="polite" className="text-13 text-sub empty:hidden">
        {status}
      </p>
    </section>
  );
}
