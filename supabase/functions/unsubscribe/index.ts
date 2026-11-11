/**
 * unsubscribe: turns email reminders off for the user in a signed token.
 * - POST from mail clients (RFC 8058 one-click, `List-Unsubscribe=One-Click`)
 * - POST {"token"} from the app's /unsubscribe page (its one button)
 * - GET (someone opening the header link): redirects to the app page, which
 *   asks first, so link scanners never unsubscribe anyone.
 */
import { verifyUnsubscribeToken } from "../../../src/features/reminders/unsubscribe-token.ts";

import { appUrl, json, unsubscribeSecret } from "../_shared/env.ts";
import { adminClient } from "../_shared/reminders.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const token = url.searchParams.get("token") ?? "";
    return Response.redirect(`${appUrl()}/unsubscribe?token=${encodeURIComponent(token)}`, 303);
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let token = url.searchParams.get("token") ?? "";
  const type = req.headers.get("Content-Type") ?? "";
  if (!token && type.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { token?: unknown };
    token = typeof body.token === "string" ? body.token : "";
  }

  const userId = await verifyUnsubscribeToken(token, unsubscribeSecret());
  if (!userId) return json({ error: "invalid_token" }, 400);

  const { error } = await adminClient()
    .from("reminder_settings")
    .update({ email: false, updated_at: new Date().toISOString() })
    .eq("profile_id", userId);
  if (error) {
    console.error("unsubscribe failed:", error.message);
    return json({ error: "failed" }, 500);
  }
  return json({ ok: true });
});
