/**
 * send-test-push: Settings → "Send me a test notification". Called by a
 * Server Action with the signed-in user's access token; pushes only to that
 * user's own devices, at most 3 an hour (notification_log, kind = test,
 * channel = push). Gone devices are removed, as in the reminder run.
 */
import { TEST_PUSH } from "../../../src/features/reminders/push.ts";

import { json } from "../_shared/env.ts";
import { pushConfigured, pushToDevices } from "../_shared/push.ts";
import { adminClient, settleDevices } from "../_shared/reminders.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const header = req.headers.get("Authorization") ?? "";
  const jwt = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!jwt) return json({ error: "unauthorized" }, 401);
  if (!pushConfigured()) return json({ error: "unavailable" }, 503);

  try {
    const db = adminClient();
    const { data, error } = await db.auth.getUser(jwt);
    const user = data?.user;
    if (error || !user) return json({ error: "unauthorized" }, 401);

    const { data: devices } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("profile_id", user.id);
    if (!devices?.length) return json({ error: "no_devices" }, 409);

    const allowed = await db.rpc("allow_test", { p_profile_id: user.id, p_channel: "push" });
    if (allowed.error) throw new Error(allowed.error.message);
    if (allowed.data !== true) return json({ error: "too_many" }, 429);

    const results = await pushToDevices(devices, { ...TEST_PUSH, tag: crypto.randomUUID() });
    const settled = await settleDevices(db, results, devices.length);
    const sent = results.filter((r) => r.status === "sent").length;
    if (!settled.ok)
      return json({ error: settled.nothingToSend ? "no_devices" : "send_failed" }, 502);
    return json({ ok: true, sent });
  } catch (error) {
    console.error("send-test-push failed:", error instanceof Error ? error.message : "unknown");
    return json({ error: "failed" }, 500);
  }
});
