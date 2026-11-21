"use client";

import { GiftIcon, LockIcon } from "lucide-react";
import * as React from "react";

import { Switch } from "@/components/ui/switch";

import { setShareBirthday } from "../actions";

/**
 * Profile → Who can see what (AppProfile). The birthday switch is real;
 * the two wishlist rows say how lists are shared today.
 */
export function PrivacyCard({ shareBirthday }: { shareBirthday: boolean }) {
  const [on, setOn] = React.useState(shareBirthday);
  const [status, setStatus] = React.useState("");

  const change = async (next: boolean) => {
    setOn(next);
    const result = await setShareBirthday(next);
    if (!result.ok) {
      setOn(!next);
      setStatus(result.message);
      return;
    }
    setStatus(
      next
        ? "Your connections can see your birthday again."
        : "Hidden. Your connections won't see your birthday.",
    );
  };

  return (
    <section
      aria-labelledby="privacy-title"
      className="flex flex-col gap-4 rounded-card-lg bg-card p-6 shadow-card sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id="privacy-title" className="text-22 font-extrabold tracking-[-0.02em]">
          Who can see what
        </h2>
        <p className="text-15 text-sub">Your connections only ever see what&apos;s below.</p>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-[20px] bg-card2 px-4 py-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor="share-birthday" className="text-15 font-bold">
            Show my birthday to my connections
          </label>
          <span id="share-birthday-hint" className="text-14 text-sub">
            Day and month only, never the year. Off: no date, no countdown, no gift reminders about
            you.
          </span>
        </div>
        <Switch
          id="share-birthday"
          aria-describedby="share-birthday-hint"
          checked={on}
          onCheckedChange={(next) => void change(next)}
        />
      </div>
      <dl className="grid gap-2 text-15">
        <div className="flex flex-wrap justify-between gap-x-4 rounded-[20px] bg-card2 px-4 py-3">
          <dt className="font-bold">
            <GiftIcon
              aria-hidden
              className="mr-2 inline size-[18px] align-[-3px] text-accent-text"
            />
            Birthday wishlist
          </dt>
          <dd className="text-sub">Your connections</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 rounded-[20px] bg-card2 px-4 py-3">
          <dt className="font-bold">
            <LockIcon
              aria-hidden
              className="mr-2 inline size-[18px] align-[-3px] text-accent-text"
            />
            Treat yourself
          </dt>
          <dd className="text-sub">Only you</dd>
        </div>
      </dl>
      <p role="status" aria-live="polite" className="text-14 text-sub empty:hidden">
        {status}
      </p>
    </section>
  );
}
