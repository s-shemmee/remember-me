"use client";

import * as React from "react";

import { Switch } from "@/components/ui/switch";

import { setRemindMyDay } from "../actions";

/**
 * "Remind me about my own day" (off by default): 7 days before ("Time to
 * update your wishlist?") and a birthday message on the morning itself, by
 * email and/or notification, the way your other reminders arrive. "Remind my
 * people" is coming later.
 */
export function OwnDayReminders({ initial }: { initial: boolean }) {
  const [on, setOn] = React.useState(initial);
  const [message, setMessage] = React.useState("");
  const id = React.useId();

  const change = async (next: boolean) => {
    setOn(next);
    const result = await setRemindMyDay(next);
    if (!result.ok) {
      setOn(!next);
      setMessage(result.message);
      return;
    }
    setMessage(
      next ? "I'll remind you 7 days before, and say happy birthday on the day ✨" : "Off",
    );
  };

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex min-w-0 flex-col gap-4 rounded-[28px] bg-card px-[22px] py-5 shadow-card"
    >
      <h2 id={`${id}-heading`} className="sr-only">
        Reminders for your day
      </h2>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <label htmlFor={id} className="flex-1 text-16 font-extrabold">
            Remind me about my own day
          </label>
          <Switch
            id={id}
            checked={on}
            aria-describedby={`${id}-hint`}
            onCheckedChange={(next) => void change(next)}
          />
        </div>
        <p id={`${id}-hint`} className="text-13 text-sub">
          7 days before, and a birthday message on the morning itself. By email or notification, the
          way your reminders arrive.
        </p>
        <p role="status" aria-live="polite" className="text-13 font-semibold text-sub empty:hidden">
          {message}
        </p>
      </div>
      <div className="flex items-center gap-3 border-t border-line pt-4">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-16 font-extrabold">Remind my people</span>
          <span className="text-13 text-sub">
            A gentle nudge to your connections before your day.
          </span>
        </span>
        <span className="shrink-0 rounded-pill bg-card2 px-3 py-1.5 text-13 font-bold">
          Coming soon
        </span>
      </div>
    </section>
  );
}
