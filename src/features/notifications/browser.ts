"use client";

/**
 * Browser-side push and install helpers. Permission is only ever requested
 * from a tap (subscribeThisDevice), never on page load.
 */

import { base64UrlToBytes, deviceLabel } from "./device";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// The install prompt fires once, on whatever page is open: keep it here.
let installEvent: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function listenForInstallPrompt() {
  if (typeof window === "undefined") return () => undefined;
  const onPrompt = (event: Event) => {
    event.preventDefault(); // we show our own "Install app" button instead
    installEvent = event as InstallPromptEvent;
    emit();
  };
  const onInstalled = () => {
    installEvent = null;
    emit();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

export const installPromptStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => installEvent !== null,
  getServer: () => false,
};

export async function promptInstall(): Promise<boolean> {
  if (!installEvent) return false;
  const event = installEvent;
  installEvent = null;
  emit();
  await event.prompt();
  return (await event.userChoice).outcome === "accepted";
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

/** This device's current push subscription, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  return (await (await registration())?.pushManager.getSubscription()) ?? null;
}

export type SubscribeResult =
  | {
      ok: true;
      subscription: { endpoint: string; keys: { p256dh: string; auth: string }; label: string };
    }
  | { ok: false; reason: "denied" | "no-worker" | "failed" };

/** Asks the browser (from a tap), then subscribes this device. */
export async function subscribeThisDevice(vapidKey: string): Promise<SubscribeResult> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
  ]);
  if (!reg) return { ok: false, reason: "no-worker" };
  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(vapidKey),
      }));
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
      return { ok: false, reason: "failed" };
    return {
      ok: true,
      subscription: {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        label: deviceLabel(navigator.userAgent),
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Unsubscribes this device in the browser; returns its endpoint (to delete the row). */
export async function unsubscribeThisDevice(): Promise<string | null> {
  try {
    const sub = await currentSubscription();
    if (!sub) return null;
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => false);
    return endpoint;
  } catch {
    return null;
  }
}
