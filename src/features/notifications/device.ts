/**
 * Device facts for Settings → Notifications and App: a friendly label for
 * the device list, iPhone/iPad detection (where push needs the installed
 * app, iOS 16.4+), and which state to show. Pure, unit-tested.
 */

/** "Chrome on Android", "Safari on iPhone", "Edge on Windows"… */
export function deviceLabel(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Browser";
  const system = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  return system ? `${browser} on ${system}` : browser;
}

/** iPhone, iPod or iPad (iPadOS reports as a Mac with touch). */
export function isAppleMobile(ua: string, maxTouchPoints = 0): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

export type NotificationState =
  | "loading"
  | "unavailable" // not set up on our side (no VAPID key)
  | "unsupported" // this browser can't do web push
  | "ios-install" // iPhone/iPad, not installed yet
  | "blocked" // permission denied
  | "off" // can turn on
  | "on"; // this device is subscribed

export function notificationState(f: {
  ready: boolean;
  hasKey: boolean;
  supported: boolean;
  appleMobile: boolean;
  standalone: boolean;
  permission: NotificationPermission | "unknown";
  subscribed: boolean;
}): NotificationState {
  if (!f.ready) return "loading";
  if (!f.hasKey) return "unavailable";
  if (f.appleMobile && !f.standalone) return "ios-install";
  if (!f.supported) return "unsupported";
  if (f.permission === "denied") return "blocked";
  return f.subscribed ? "on" : "off";
}

export type InstallState = "installed" | "prompt" | "ios" | "manual";

export function installState(f: {
  standalone: boolean;
  canPrompt: boolean;
  appleMobile: boolean;
}): InstallState {
  if (f.standalone) return "installed";
  if (f.appleMobile) return "ios";
  return f.canPrompt ? "prompt" : "manual";
}

/** base64url → bytes (the VAPID public key for pushManager.subscribe). */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
