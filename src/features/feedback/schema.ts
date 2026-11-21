import { z } from "zod";

/**
 * Help & feedback: what a message may hold, shared by the Server Action,
 * the send-feedback Edge Function and Vitest (relative imports only).
 *
 * The optional page and device info is only ever the browser, the screen
 * size and the route: never people, wishes or names. The route keeps known
 * sections only, so ids, invite tokens and search words never leave.
 */
export const FEEDBACK_TYPES = ["idea", "broken", "other"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_LABELS: Record<FeedbackType, string> = {
  idea: "An idea",
  broken: "Something's broken",
  other: "Something else",
};

export const FEEDBACK_MAX = 1000;
export const FEEDBACK_DAILY_LIMIT = 5;

/** The app's sections a route may name (anything else is just "/"). */
const SECTIONS = new Set([
  "home",
  "people",
  "calendar",
  "wishlists",
  "celebrate",
  "profile",
  "settings",
  "help",
]);

/**
 * "/settings/privacy" stays, "/people?person=…" becomes "/people",
 * "/invite/<token>" becomes "/". Two levels at most, letters and dashes only.
 */
export function safeRoute(path: string): string {
  const pathname = path.split(/[?#]/)[0] ?? "";
  const [first, second] = pathname.split("/").filter(Boolean);
  if (!first || !SECTIONS.has(first)) return "/";
  return second && /^[a-z-]{1,40}$/.test(second) ? `/${first}/${second}` : `/${first}`;
}

/** "Chrome 131 on Windows": a browser and system name, nothing that identifies you. */
export function browserLabel(userAgent: string): string {
  const ua = userAgent.slice(0, 400);
  const browser =
    /Edg\/(\d+)/.exec(ua)?.[1] !== undefined
      ? `Edge ${/Edg\/(\d+)/.exec(ua)![1]}`
      : /Firefox\/(\d+)/.test(ua)
        ? `Firefox ${/Firefox\/(\d+)/.exec(ua)![1]}`
        : /Chrome\/(\d+)/.test(ua)
          ? `Chrome ${/Chrome\/(\d+)/.exec(ua)![1]}`
          : /Version\/(\d+)[\d.]* .*Safari/.test(ua)
            ? `Safari ${/Version\/(\d+)/.exec(ua)![1]}`
            : "Another browser";
  const system = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "another system";
  return `${browser} on ${system}`;
}

export const feedbackMetaSchema = z
  .object({
    browser: z.string().max(60),
    screen: z.string().regex(/^\d{2,5}x\d{2,5}$/),
    route: z
      .string()
      .max(90)
      .refine((r) => safeRoute(r) === r, { error: "Only a section of the app." }),
  })
  .strict();
export type FeedbackMeta = z.infer<typeof feedbackMetaSchema>;

export const feedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES, { error: "Pick what it's about." }),
  message: z
    .string()
    .trim()
    .min(1, { error: "Write a few words first." })
    .max(FEEDBACK_MAX, { error: `Up to ${FEEDBACK_MAX} characters.` }),
  meta: feedbackMetaSchema.nullable(),
});
export type FeedbackInput = z.input<typeof feedbackSchema>;

export type FeedbackResult =
  { ok: true } | { ok: false; message: string; field?: "type" | "message" };

export const FEEDBACK_REPLIES = {
  limit: `That's ${FEEDBACK_DAILY_LIMIT} messages in a day, thank you. Please send more tomorrow.`,
  failed: "That didn't send. Please try again in a moment.",
} as const;

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** The email to us (plain, no tracking): the type, the message and the optional info. */
export function feedbackEmail(f: {
  id: string;
  type: FeedbackType;
  message: string;
  meta: Partial<FeedbackMeta> | null;
  createdAt: string;
}): { subject: string; text: string; html: string } {
  const label = FEEDBACK_LABELS[f.type] ?? "Feedback";
  const info =
    f.meta && Object.keys(f.meta).length
      ? [
          f.meta.browser ? `Browser: ${f.meta.browser}` : null,
          f.meta.screen ? `Screen: ${f.meta.screen}` : null,
          f.meta.route ? `Page: ${f.meta.route}` : null,
        ].filter((l): l is string => l !== null)
      : ["No page or device info (they switched it off)."];
  const lines = [`${label}`, "", f.message, "", ...info, `Sent: ${f.createdAt}`, `Ref: ${f.id}`];
  const firstLine = f.message.split("\n")[0]!.slice(0, 60);
  return {
    subject: `Feedback: ${label} · ${firstLine}`,
    text: lines.join("\n"),
    html: `<!doctype html><html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; font-size: 15px; line-height: 1.5"><p><strong>${escapeHtml(label)}</strong></p><p style="white-space: pre-wrap">${escapeHtml(f.message)}</p><p style="color: #6b6b6b; font-size: 13px">${info.map(escapeHtml).join("<br>")}<br>Sent: ${escapeHtml(f.createdAt)}<br>Ref: ${escapeHtml(f.id)}</p></body></html>`,
  };
}
