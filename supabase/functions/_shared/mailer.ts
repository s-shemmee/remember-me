/**
 * Sending email: Resend in the cloud (RESEND_API_KEY), Mailpit's send API on
 * a local Supabase (so local runs and CI land in Mailpit). Never Mailpit in
 * the cloud, never Resend without a key.
 */
import type { OutgoingEmail, SendResult } from "../../../src/features/reminders/run.ts";

import { EMAIL_FROM, isLocal } from "./env.ts";

async function viaResend(email: OutgoingEmail, apiKey: string): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Resend keeps keys for 24 hours: a retry with the same key is never delivered twice.
      "Idempotency-Key": email.idempotencyKey,
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: email.headers,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    message?: string;
  };
  if (res.ok) return { ok: true, id: body.id ?? null };
  // The key was already used for a request Resend accepted (e.g. the payload
  // changed slightly since): that email went out.
  if (res.status === 409 && body.name === "invalid_idempotent_request") {
    return { ok: false, alreadySent: true, error: "idempotency key already used" };
  }
  return { ok: false, error: `resend ${res.status} ${body.name ?? ""}`.trim() };
}

async function viaMailpit(email: OutgoingEmail, base: string): Promise<SendResult> {
  const [, name = "", address = EMAIL_FROM] = /^(.*?)\s*<([^>]+)>$/.exec(EMAIL_FROM) ?? [];
  const res = await fetch(`${base.replace(/\/+$/, "")}/api/v1/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: { Email: address, Name: name },
      To: [{ Email: email.to }],
      Subject: email.subject,
      HTML: email.html,
      Text: email.text,
      Headers: { ...email.headers, "X-Idempotency-Key": email.idempotencyKey },
    }),
  });
  if (!res.ok) return { ok: false, error: `mailpit ${res.status}` };
  const body = (await res.json().catch(() => ({}))) as { ID?: string };
  return { ok: true, id: body.ID ?? null };
}

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) return viaResend(email, resendKey);
  const mailpit = Deno.env.get("MAILPIT_URL");
  if (mailpit && isLocal()) return viaMailpit(email, mailpit);
  return { ok: false, error: "no email transport configured" };
}

/** "s•••@gmail.com" for messages shown to the user. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain}`;
}
