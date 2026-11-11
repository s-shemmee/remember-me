"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { REMINDER_OPTIONS } from "@/features/onboarding/constants";

import { saveReminderSettings, sendTestEmail } from "../actions";
import type { ReminderSettings as Settings } from "../schema";

/**
 * Settings → Reminders (AppSettings): which days before, email on or off,
 * and a test email. Saved automatically as you go; the result is announced
 * politely. Reminders arrive at 9:00 your time.
 */
export function ReminderSettings({ initial, email }: { initial: Settings; email: string }) {
  const [value, setValue] = React.useState(initial);
  const [saved, setSaved] = React.useState("");
  const [test, setTest] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [sending, setSending] = React.useState(false);
  const last = React.useRef(initial);

  const save = async (next: Settings) => {
    setValue(next);
    setSaved("Saving…");
    const result = await saveReminderSettings(next);
    if (result.ok) {
      last.current = next;
      setSaved("Saved ✓");
    } else {
      setValue(last.current);
      setSaved(result.message);
    }
  };

  const toggle = (days: number) =>
    void save({
      ...value,
      offsets: value.offsets.includes(days)
        ? value.offsets.filter((d) => d !== days)
        : [...value.offsets, days].sort((a, b) => b - a),
    });

  const onTest = async () => {
    setSending(true);
    setTest(null);
    setTest(await sendTestEmail());
    setSending(false);
  };

  return (
    <section
      id="reminders"
      aria-labelledby="reminders-title"
      className="flex scroll-mt-6 flex-col gap-6 rounded-card-lg bg-card p-6 shadow-card sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="reminders-title" className="text-22 font-extrabold tracking-[-0.02em]">
            <span aria-hidden>🔔 </span>Reminders
          </h2>
          <p className="text-15 text-sub">When Noor should nudge you before someone&apos;s day</p>
        </div>
        <p role="status" aria-live="polite" className="min-h-6 text-14 font-semibold text-sub">
          {saved}
        </p>
      </div>

      <div className="grid gap-2">
        <span id="remind-me-label" className="text-15 font-bold">
          Remind me
        </span>
        <div
          role="group"
          aria-labelledby="remind-me-label"
          aria-describedby="remind-me-hint"
          className="flex flex-wrap gap-2"
        >
          {REMINDER_OPTIONS.map((o) => (
            <button
              key={o.days}
              type="button"
              aria-pressed={value.offsets.includes(o.days)}
              onClick={() => toggle(o.days)}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-pill bg-card2 px-4 text-15 font-semibold text-text transition-colors duration-200 ease-soft aria-pressed:bg-text aria-pressed:text-bg"
            >
              {o.label}
            </button>
          ))}
        </div>
        <p id="remind-me-hint" className="text-14 text-sub">
          {value.offsets.length
            ? "Reminders arrive at 9:00 in the morning, your time."
            : "No days picked, so no reminders. Pick one to hear from me again."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-[20px] bg-card2 px-4 py-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor="reminders-email" className="text-15 font-bold">
            By email
          </label>
          <span id="reminders-email-hint" className="text-14 [overflow-wrap:anywhere] text-sub">
            A short email to {email}, with their wishlist one tap away
          </span>
        </div>
        <Switch
          id="reminders-email"
          aria-describedby="reminders-email-hint"
          checked={value.email}
          onCheckedChange={(email) => void save({ ...value, email })}
        />
      </div>

      <div className="flex flex-col items-start gap-2">
        <Button variant="card2" disabled={sending} onClick={() => void onTest()}>
          {sending ? "Sending…" : "Send me a test email"}
        </Button>
        <p
          role="status"
          aria-live="polite"
          className={
            test?.ok === false ? "text-14 font-semibold text-accent-text" : "text-14 text-sub"
          }
        >
          {test?.message ?? ""}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-[20px] border-[1.5px] border-dashed border-line px-4 py-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-15 font-bold">Notifications on this device</span>
          <span className="text-14 text-sub">Coming soon, with the app on your home screen</span>
        </div>
      </div>
    </section>
  );
}
