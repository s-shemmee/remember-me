/**
 * account-notice: "You already have an account". Called only by our Next
 * server (sign-up, the "Resend" button, change email) with
 * `Authorization: Bearer <ACCOUNT_NOTICE_SECRET>`; anything else gets 401.
 *
 * Emails an address only when it has a confirmed account, at most once an
 * hour per address and 200 a day overall (claim_account_notice). The log
 * holds an HMAC of the address, never the address. The answer is always the
 * same `{ ok: true }`, so a caller learns nothing about the address.
 */
import { renderAccountExistsEmail } from "../../../src/features/auth/account-exists-email.tsx";
import {
  emailHash,
  isNoticeCaller,
  noticeEmail,
} from "../../../src/features/auth/account-notice.ts";

import { accountNoticeSecret, appUrl, emailHashSecret, json } from "../_shared/env.ts";
import { sendEmail } from "../_shared/mailer.ts";
import { adminClient } from "../_shared/reminders.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let secret = "";
  try {
    secret = accountNoticeSecret();
  } catch (error) {
    console.error("account-notice:", error instanceof Error ? error.message : "no secret");
    return json({ error: "unauthorized" }, 401);
  }
  if (!isNoticeCaller(req.headers.get("Authorization"), secret)) {
    return json({ error: "unauthorized" }, 401);
  }

  const email = noticeEmail(await req.json().catch(() => null));
  if (!email) return json({ error: "invalid_request" }, 400);

  try {
    const hash = await emailHash(emailHashSecret(), email);
    const db = adminClient();
    const claimed = await db.rpc("claim_account_notice", { p_email: email, p_hash: hash });
    if (claimed.error) throw new Error(claimed.error.message);
    if (claimed.data === true) {
      const message = await renderAccountExistsEmail(appUrl());
      const sent = await sendEmail({
        ...message,
        to: email,
        headers: {},
        idempotencyKey: crypto.randomUUID(),
      });
      if (!sent.ok) console.error("account-notice: send failed");
    }
    // The same answer whether or not anything was sent.
    return json({ ok: true });
  } catch (error) {
    console.error("account-notice failed:", error instanceof Error ? error.message : "unknown");
    return json({ error: "failed" }, 500);
  }
});
