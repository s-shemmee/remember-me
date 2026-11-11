/**
 * Reminder and test emails, rendered with @react-email/render (HTML and a
 * plain-text version). Light only, table layout, inline styles: what email
 * clients understand. Accessible: lang, real headings, 16px text, 4.5:1
 * contrast (the light theme's tokens), 44px buttons, no images needed.
 * Shared with the Edge Functions, so imports end in `.ts`.
 */
import { render } from "@react-email/render";
import type * as React from "react";

import type { DueReminder } from "./due.ts";
import { reminderLine, reminderPreview, reminderSubject } from "./copy.ts";

/** The light theme (src/app/globals.css); a test keeps these in step. */
export const EMAIL_COLORS = {
  bg: "#f4f5f9",
  card: "#ffffff",
  card2: "#e9ebf1",
  text: "#1c1b1f",
  sub: "#5f5c66",
  line: "#e2e4eb",
  accent: "#d63b48",
  accentText: "#c2333f",
  onAccent: "#ffffff",
} as const;

export const EMAIL_PASTELS = {
  peach: { fill: "#ffe5d6", ink: "#8a3b12" },
  lilac: { fill: "#eae3ff", ink: "#5b3fb5" },
  mint: { fill: "#d7f5e6", ink: "#1e6b49" },
  sky: { fill: "#dcebff", ink: "#1f4f8f" },
  rose: { fill: "#ffe0ea", ink: "#9a2e55" },
  butter: { fill: "#fff1c2", ink: "#5e4500" },
} as const;

const pastelOf = (c: string) =>
  EMAIL_PASTELS[c as keyof typeof EMAIL_PASTELS] ?? EMAIL_PASTELS.lilac;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type EmailLinks = {
  /** The app, e.g. https://remember-me.app (no trailing slash). */
  appUrl: string;
  /** The unsubscribe page in the app, with its signed token. */
  unsubscribeUrl: string;
};

function Layout({
  title,
  preview,
  children,
  links,
  reason,
}: {
  /** The subject: the document title screen readers announce. */
  title: string;
  preview: string;
  children: React.ReactNode;
  links: EmailLinks;
  reason: string;
}) {
  return (
    <html lang="en" dir="ltr">
      {/* An email document, not a Next page: a plain <head> is right here. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <title>{title}</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: EMAIL_COLORS.bg }}>
        {/* Inbox preview text, hidden in the email itself. */}
        <div
          data-skip-in-text="true"
          style={{
            display: "none",
            overflow: "hidden",
            maxHeight: 0,
            lineHeight: "1px",
            opacity: 0,
          }}
        >
          {preview}
        </div>
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ backgroundColor: EMAIL_COLORS.bg }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: "32px 16px" }}>
                <table
                  role="presentation"
                  width="100%"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{ maxWidth: 560, fontFamily: FONT, color: EMAIL_COLORS.text }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "0 8px 20px", fontSize: 20, fontWeight: 800 }}>
                        <span aria-hidden="true">🕯️ </span>Remember{" "}
                        <span
                          style={{
                            fontFamily: "Georgia, 'Times New Roman', serif",
                            fontStyle: "italic",
                            fontWeight: 400,
                            color: EMAIL_COLORS.accentText,
                          }}
                        >
                          me
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          backgroundColor: EMAIL_COLORS.card,
                          borderRadius: 24,
                          padding: "28px 24px",
                        }}
                      >
                        {children}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: "20px 8px 0",
                          fontSize: 14,
                          lineHeight: "22px",
                          color: EMAIL_COLORS.sub,
                        }}
                      >
                        <p style={{ margin: "0 0 8px" }}>{reason}</p>
                        <p style={{ margin: 0 }}>
                          <a
                            href={`${links.appUrl}/settings#reminders`}
                            style={{ color: EMAIL_COLORS.accentText }}
                          >
                            Change reminders
                          </a>
                          {" · "}
                          <a href={links.unsubscribeUrl} style={{ color: EMAIL_COLORS.accentText }}>
                            Unsubscribe
                          </a>
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: EMAIL_COLORS.accent,
        color: EMAIL_COLORS.onAccent,
        fontSize: 16,
        fontWeight: 700,
        lineHeight: "20px",
        textDecoration: "none",
        borderRadius: 999,
        padding: "12px 22px",
      }}
    >
      {children}
    </a>
  );
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: EMAIL_COLORS.card2,
        color: EMAIL_COLORS.text,
        fontSize: 16,
        fontWeight: 700,
        lineHeight: "20px",
        textDecoration: "none",
        borderRadius: 999,
        padding: "12px 22px",
      }}
    >
      {children}
    </a>
  );
}

const TEST_SUBJECT = "Your Remember Me reminders are on 🕯️";

const REASON = "You're getting this because you turned on email reminders in Remember Me.";

export function ReminderEmail({
  firstName,
  reminders,
  links,
}: {
  firstName: string;
  reminders: DueReminder[];
  links: EmailLinks;
}) {
  return (
    <Layout
      title={reminderSubject(reminders)}
      preview={reminderPreview(reminders)}
      links={links}
      reason={REASON}
    >
      <h1 style={{ margin: "0 0 6px", fontSize: 24, lineHeight: "30px", fontWeight: 800 }}>
        {firstName ? `Hi ${firstName},` : "Hi,"}
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 16, lineHeight: "24px", color: EMAIL_COLORS.sub }}>
        {reminders.length === 1
          ? "Here's a day to keep in mind."
          : `Here are ${reminders.length} days to keep in mind.`}
      </p>
      {reminders.map((r) => {
        const line = reminderLine(r);
        const pastel = pastelOf(r.day.personColor);
        return (
          <table
            key={r.key}
            role="presentation"
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            style={{ marginBottom: 16 }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    backgroundColor: line.gentle ? EMAIL_COLORS.card2 : pastel.fill,
                    color: line.gentle ? EMAIL_COLORS.text : pastel.ink,
                    borderRadius: 20,
                    padding: "18px 20px",
                  }}
                >
                  <h2
                    style={{ margin: "0 0 4px", fontSize: 19, lineHeight: "26px", fontWeight: 800 }}
                  >
                    {line.headline}
                  </h2>
                  <p style={{ margin: 0, fontSize: 16, lineHeight: "24px" }}>{line.date}</p>
                  {line.detail && (
                    <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: "24px" }}>
                      {line.detail}
                    </p>
                  )}
                  <p style={{ margin: "14px 0 0" }}>
                    {line.wishlistLabel && r.day.wishlistFriendId ? (
                      <ButtonLink
                        href={`${links.appUrl}/wishlists?tab=friends&friend=${r.day.wishlistFriendId}`}
                      >
                        {line.wishlistLabel}
                      </ButtonLink>
                    ) : (
                      <SecondaryLink href={`${links.appUrl}/people?person=${r.day.personId}`}>
                        Open {r.day.personName}
                      </SecondaryLink>
                    )}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        );
      })}
      <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: "24px" }}>
        With love,
        <br />
        Noor <span aria-hidden="true">🕯️</span>
      </p>
    </Layout>
  );
}

export function TestEmail({ firstName, links }: { firstName: string; links: EmailLinks }) {
  return (
    <Layout
      title={TEST_SUBJECT}
      preview="Your reminders will look like this."
      links={links}
      reason={REASON}
    >
      <h1 style={{ margin: "0 0 6px", fontSize: 24, lineHeight: "30px", fontWeight: 800 }}>
        {firstName ? `Hi ${firstName},` : "Hi,"}
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 16, lineHeight: "24px" }}>
        This is a test from Remember Me. Your reminders will arrive at this address, at 9:00 in the
        morning, your time.
      </p>
      <ButtonLink href={`${links.appUrl}/settings#reminders`}>Open my settings</ButtonLink>
      <p style={{ margin: "20px 0 0", fontSize: 16, lineHeight: "24px" }}>
        With love,
        <br />
        Noor <span aria-hidden="true">🕯️</span>
      </p>
    </Layout>
  );
}

export type RenderedEmail = { subject: string; html: string; text: string };

/** Plain text: headings keep their case; links show their address. */
const TEXT_OPTIONS = {
  wordwrap: 78,
  selectors: [
    { selector: "h1", options: { uppercase: false } },
    { selector: "h2", options: { uppercase: false } },
  ],
};

export async function renderReminderEmail(args: {
  firstName: string;
  reminders: DueReminder[];
  links: EmailLinks;
}): Promise<RenderedEmail> {
  const el = <ReminderEmail {...args} />;
  return {
    subject: reminderSubject(args.reminders),
    html: await render(el),
    text: await render(el, { plainText: true, htmlToTextOptions: TEXT_OPTIONS }),
  };
}

export async function renderTestEmail(args: {
  firstName: string;
  links: EmailLinks;
}): Promise<RenderedEmail> {
  const el = <TestEmail {...args} />;
  return {
    subject: TEST_SUBJECT,
    html: await render(el),
    text: await render(el, { plainText: true, htmlToTextOptions: TEXT_OPTIONS }),
  };
}
