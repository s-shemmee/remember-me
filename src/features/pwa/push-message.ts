/**
 * What the service worker does with a push: read the payload safely and
 * pick the page a click opens. Pure, unit-tested, bundled into the worker.
 */

export type ShownNotification = {
  title: string;
  options: { body: string; tag: string; icon: string; badge: string; data: { url: string } };
};

const FALLBACK_URL = "/home";

/** Only same-origin paths ("/people?person=…"), never "//evil.example" or "https://…". */
export function safePath(value: unknown): string {
  if (typeof value !== "string" || value.length > 300) return FALLBACK_URL;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return FALLBACK_URL;
  return value;
}

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

/** The notification to show for a push, or a gentle default if the payload is odd. */
export function notificationFor(data: unknown): ShownNotification {
  const d = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  return {
    title: text(d.title, 120) ?? "Remember Me",
    options: {
      body: text(d.body, 200) ?? "",
      tag: text(d.tag, 100) ?? "remember-me",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: safePath(d.url) },
    },
  };
}

/** Parses a push message's text; anything that isn't JSON becomes the default. */
export function parsePush(textData: string | null | undefined): ShownNotification {
  try {
    return notificationFor(textData ? JSON.parse(textData) : null);
  } catch {
    return notificationFor(null);
  }
}
