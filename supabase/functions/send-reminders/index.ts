/**
 * send-reminders: called by pg_cron every 15 minutes (Authorization: Bearer
 * CRON_SECRET). Finds due reminders, claims them in notification_log, sends
 * one email per person and marks them sent. See src/features/reminders/run.ts.
 *
 * Tests may pass {"now": "<ISO date>"}: honoured only when
 * REMINDERS_ALLOW_NOW=1 AND Supabase is local.
 */
import { runReminders } from "../../../src/features/reminders/run.ts";

import { allowNowOverride, isCron, json } from "../_shared/env.ts";
import { sendEmail } from "../_shared/mailer.ts";
import {
  adminClient,
  pushDeliverer,
  reminderStore,
  unsubscribeLinks,
} from "../_shared/reminders.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isCron(req)) return json({ error: "unauthorized" }, 401);

  let now = new Date();
  const body = (await req.json().catch(() => ({}))) as { now?: unknown };
  if (body.now !== undefined) {
    if (!allowNowOverride()) return json({ error: "now_not_allowed" }, 400);
    const parsed = new Date(String(body.now));
    if (Number.isNaN(parsed.getTime())) return json({ error: "invalid_now" }, 400);
    now = parsed;
  }

  try {
    const db = adminClient();
    const summary = await runReminders({
      now,
      store: reminderStore(db),
      // Push loads devices once per run; without VAPID keys it is skipped.
      push: await pushDeliverer(db),
      send: sendEmail,
      // React and the renderer load only when there's an email to render:
      // most runs (every 15 minutes) have nothing due and stay light.
      render: async ({ user, reminders }) =>
        (await import("../../../src/features/reminders/email.tsx")).renderReminderEmail({
          firstName: user.firstName,
          reminders,
          links: (await unsubscribeLinks(user.profileId)).links,
        }),
      headersFor: async (user) => (await unsubscribeLinks(user.profileId)).headers,
      newId: () => crypto.randomUUID(),
    });
    console.log(JSON.stringify({ job: "send-reminders", ...summary }));
    return json(summary);
  } catch (error) {
    // No personal data in logs: just the message.
    console.error("send-reminders failed:", error instanceof Error ? error.message : "unknown");
    return json({ error: "failed" }, 500);
  }
});
