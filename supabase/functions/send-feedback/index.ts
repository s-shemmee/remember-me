/**
 * send-feedback: emails new Help & feedback messages to contact@. Called by
 * the sendFeedback Server Action with the signed-in user's token, right
 * after it saved a message (RLS insert, 5 in 24 hours).
 *
 * Claims that user's messages not emailed yet (from the last day) by setting
 * emailed_at, sends each one (Reply-To: the sender, so we can answer), and
 * clears emailed_at again if a send fails, so the next call retries it.
 * Never logs a message or an address.
 */
import { CONTACT_EMAIL } from "../../../src/lib/contact.ts";
import {
  feedbackEmail,
  type FeedbackMeta,
  type FeedbackType,
} from "../../../src/features/feedback/schema.ts";

import { json } from "../_shared/env.ts";
import { sendEmail } from "../_shared/mailer.ts";
import { adminClient } from "../_shared/reminders.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json({ error: "unauthorized" }, 401);

  try {
    const db = adminClient();
    const { data: auth, error: authError } = await db.auth.getUser(token);
    const user = auth?.user;
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await db
      .from("feedback")
      .update({ emailed_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("emailed_at", null)
      .gt("created_at", since)
      .select("id, type, message, meta, created_at");
    if (error) throw new Error(error.message);

    let sent = 0;
    for (const row of rows ?? []) {
      const email = feedbackEmail({
        id: row.id as string,
        type: row.type as FeedbackType,
        message: row.message as string,
        meta: (row.meta ?? null) as Partial<FeedbackMeta> | null,
        createdAt: row.created_at as string,
      });
      const result = await sendEmail({
        ...email,
        to: CONTACT_EMAIL,
        headers: {},
        ...(user.email ? { replyTo: user.email } : {}),
        idempotencyKey: `feedback-${row.id}`,
      });
      if (result.ok || result.alreadySent) {
        sent++;
      } else {
        await db
          .from("feedback")
          .update({ emailed_at: null })
          .eq("id", row.id as string);
        console.error("send-feedback: send failed", result.error);
      }
    }
    return json({ sent });
  } catch (error) {
    console.error(
      "send-feedback failed:",
      error instanceof Error ? error.message.slice(0, 120) : "unknown",
    );
    return json({ error: "failed" }, 500);
  }
});
