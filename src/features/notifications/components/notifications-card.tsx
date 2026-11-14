"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

import { removeDevice, savePushSubscription, sendTestNotification, turnOffPush } from "../actions";
import {
  currentSubscription,
  isStandalone,
  pushSupported,
  subscribeThisDevice,
  unsubscribeThisDevice,
} from "../browser";
import { isAppleMobile, notificationState } from "../device";
import { NOTIFICATION_COPY } from "../messages";

async function loadFacts(): Promise<Facts> {
  const supported = pushSupported();
  const sub = supported ? await currentSubscription() : null;
  return {
    supported,
    appleMobile: isAppleMobile(navigator.userAgent, navigator.maxTouchPoints),
    standalone: isStandalone(),
    permission: "Notification" in window ? Notification.permission : "unknown",
    endpoint: sub?.endpoint ?? null,
  };
}

export type Device = {
  id: string;
  label: string;
  endpoint: string;
  /** "Added 12 Nov · Last used today". */
  line: string;
};

type Facts = {
  supported: boolean;
  appleMobile: boolean;
  standalone: boolean;
  permission: NotificationPermission | "unknown";
  endpoint: string | null;
};

/**
 * Settings → Notifications: turn push on for this device (the browser asks
 * only after this tap), your devices with Remove, a test notification, and
 * turning it all off. iPhone: only once the app is on the Home Screen.
 */
export function NotificationsCard({
  devices,
  vapidKey,
}: {
  devices: Device[];
  vapidKey: string | null;
}) {
  const router = useRouter();
  const [facts, setFacts] = React.useState<Facts | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<{ ok: boolean; message: string } | null>(null);

  const readFacts = React.useCallback(async () => setFacts(await loadFacts()), []);

  React.useEffect(() => {
    // What this browser supports, read after mount (never on the server).
    let cancelled = false;
    void loadFacts().then((f) => {
      if (!cancelled) setFacts(f);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const thisDevice = facts?.endpoint
    ? devices.find((d) => d.endpoint === facts.endpoint)
    : undefined;
  const state = notificationState({
    ready: facts !== null,
    hasKey: Boolean(vapidKey),
    supported: facts?.supported ?? false,
    appleMobile: facts?.appleMobile ?? false,
    standalone: facts?.standalone ?? false,
    permission: facts?.permission ?? "unknown",
    subscribed: Boolean(thisDevice),
  });

  const turnOn = async () => {
    if (!vapidKey) return;
    setBusy(true);
    setStatus(null);
    const result = await subscribeThisDevice(vapidKey);
    if (!result.ok) {
      setBusy(false);
      await readFacts();
      if (result.reason !== "denied") {
        setStatus({
          ok: false,
          message:
            result.reason === "no-worker"
              ? "The app isn't fully loaded yet. Please reload the page and try again."
              : "I couldn't turn notifications on in this browser. Please try again.",
        });
      }
      return;
    }
    const saved = await savePushSubscription(result.subscription);
    setBusy(false);
    if (!saved.ok) {
      setStatus({ ok: false, message: saved.message });
      return;
    }
    await readFacts();
    router.refresh();
    setStatus({ ok: true, message: "Notifications are on for this device ✓" });
  };

  const turnOff = async () => {
    setBusy(true);
    setStatus(null);
    await unsubscribeThisDevice();
    const result = await turnOffPush();
    setBusy(false);
    await readFacts();
    router.refresh();
    setStatus(
      result.ok
        ? { ok: true, message: "Notifications are off on all your devices." }
        : { ok: false, message: result.message },
    );
  };

  const remove = async (device: Device) => {
    if (device.endpoint === facts?.endpoint) await unsubscribeThisDevice();
    const result = await removeDevice(device.id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    await readFacts();
    router.refresh();
    toast(`${device.label} removed`);
  };

  const test = async () => {
    setBusy(true);
    setStatus(null);
    setStatus(await sendTestNotification());
    setBusy(false);
  };

  return (
    <section
      id="notifications"
      aria-labelledby="notifications-title"
      className="flex scroll-mt-6 flex-col gap-5 rounded-card-lg bg-card p-6 shadow-card sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id="notifications-title" className="text-22 font-extrabold tracking-[-0.02em]">
          <span aria-hidden>💬 </span>Notifications
        </h2>
        <p className="text-15 text-sub">A little nudge on your phone or computer</p>
      </div>

      {state === "loading" ? (
        <div aria-busy="true" className="h-11" />
      ) : (
        <p className="text-15">{NOTIFICATION_COPY[state]}</p>
      )}

      {/* Buttons and their result together: an empty status adds no gap. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {state === "off" && (
            <Button disabled={busy} onClick={() => void turnOn()}>
              {busy ? "Turning on…" : "Turn on notifications"}
            </Button>
          )}
          {state === "on" && (
            <>
              <Button variant="card2" disabled={busy} onClick={() => void test()}>
                Send me a test notification
              </Button>
              <Button variant="transparent" disabled={busy} onClick={() => void turnOff()}>
                Turn off notifications
              </Button>
            </>
          )}
          {state !== "on" && devices.length > 0 && (
            <Button variant="transparent" disabled={busy} onClick={() => void turnOff()}>
              Turn off on all devices
            </Button>
          )}
        </div>
        <p
          role="status"
          aria-live="polite"
          className={
            status?.ok === false ? "text-14 font-semibold text-accent-text" : "text-14 text-sub"
          }
        >
          {status?.message ?? ""}
        </p>
      </div>

      {devices.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 id="devices-title" className="text-15 font-bold">
            Your devices
          </h3>
          <ul aria-labelledby="devices-title" className="flex flex-col gap-2">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[20px] bg-card2 py-2 pr-2 pl-4"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-15 font-semibold [overflow-wrap:anywhere]">
                    {d.label}
                    {d.endpoint === facts?.endpoint && (
                      <span className="text-sub"> · This device</span>
                    )}
                  </span>
                  <span className="text-13 text-sub">{d.line}</span>
                </span>
                <Button
                  variant="transparent"
                  aria-label={`Remove ${d.label}${d.endpoint === facts?.endpoint ? " (this device)" : ""}`}
                  onClick={() => void remove(d)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
