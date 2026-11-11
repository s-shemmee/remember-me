/**
 * send-test-email: Settings → "Send me a test email". Called by a Server
 * Action with the signed-in user's access token; sends only to that user's
 * own confirmed address, at most 3 an hour (notification_log, kind = test).
 */
import { renderTestEmail } from "../../../src/features/reminders/email.tsx";

import { json } from "../_shared/env.ts";
import { maskEmail, sendEmail } from "../_shared/mailer.ts";
import { adminClient, unsubscribeLinks } from "../_shared/reminders.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const header = req.headers.get("Authorization") ?? "";
  const jwt = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!jwt) return json({ error: "unauthorized" }, 401);

  try {
    const db = adminClient();
    const { data, error } = await db.auth.getUser(jwt);
    const user = data?.user;
    if (error || !user?.email || !user.email_confirmed_at)
      return json({ error: "unauthorized" }, 401);

    const allowed = await db.rpc("allow_test_email", { p_profile_id: user.id });
    if (allowed.error) throw new Error(allowed.error.message);
    if (allowed.data !== true) return json({ error: "too_many" }, 429);

    const { data: profile } = await db
      .from("profiles")
      .select("first_name")
      .eq("id", user.id)
      .maybeSingle();
    const { links, headers } = await unsubscribeLinks(user.id);
    const email = await renderTestEmail({ firstName: profile?.first_name ?? "", links });
    const sent = await sendEmail({
      ...email,
      to: user.email,
      headers,
      idempotencyKey: crypto.randomUUID(),
    });
    if (!sent.ok) return json({ error: "send_failed" }, 502);
    return json({ ok: true, to: maskEmail(user.email) });
  } catch (error) {
    console.error("send-test-email failed:", error instanceof Error ? error.message : "unknown");
    return json({ error: "failed" }, 500);
  }
});
