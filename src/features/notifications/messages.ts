/** Words for Settings → Notifications and App. Plain, warm, no em dashes. */

import type { InstallState, NotificationState } from "./device";

export function testPushMessage(result: { ok: true; sent: number } | { ok: false; code: string }) {
  if (result.ok) {
    return result.sent === 1
      ? "Sent to 1 device. It should pop up in a moment."
      : `Sent to ${result.sent} devices. They should pop up in a moment.`;
  }
  switch (result.code) {
    case "too_many":
      return "That's 3 test notifications this hour. Please try again a little later.";
    case "no_devices":
      return "There's no device to send to. Turn on notifications first.";
    default:
      return "I couldn't send it just now. Please try again in a minute.";
  }
}

export const NOTIFICATION_COPY: Record<Exclude<NotificationState, "loading">, string> = {
  unavailable: "Notifications aren't available yet. Email reminders still work.",
  unsupported:
    "This browser can't show notifications from Remember Me. Email reminders still work.",
  "ios-install":
    "On iPhone and iPad, notifications work once Remember Me is on your Home Screen (iOS 16.4 or later). Add it with the steps under App, then open it from your Home Screen and come back here.",
  blocked:
    "Notifications are blocked for this site. Allow them in your browser's site settings, then come back here.",
  off: "I'll only ask your browser once you tap the button. Same days as your email reminders.",
  on: "On for this device. Same days as your email reminders.",
};

export const INSTALL_COPY: Record<InstallState, string> = {
  installed: "Remember Me is installed on this device ✓",
  prompt: "Add Remember Me to this device. It opens like an app, in its own window.",
  ios: "Tap the Share button, then Add to Home Screen.",
  manual: "Use your browser's menu to install Remember Me, or add it to your home screen.",
};

/** "today", "yesterday", "12 Nov" (dates as YYYY-MM-DD in your timezone). */
export function dayLabel(day: string | null, today: string, yesterday: string): string | null {
  if (!day) return null;
  if (day === today) return "today";
  if (day === yesterday) return "yesterday";
  const [, m, d] = day.split("-").map(Number);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d} ${months[(m ?? 1) - 1]}`;
}
