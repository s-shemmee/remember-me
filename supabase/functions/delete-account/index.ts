/**
 * delete-account: Settings → "Delete my account". Called by a Server Action
 * with the signed-in user's access token; deletes only that user.
 *
 * Checks again here (never trusting the app): the typed email matches, and
 * re-authentication: the password for email accounts, or a sign-in within
 * the last 10 minutes for Google-only accounts (the verified token's `amr`).
 *
 * Then: prepare_account_deletion() (friends' reservations on your wishes go
 * quietly, notes carrying your name go), your files in both buckets, and the
 * auth user, which cascades through every table.
 */
import { createClient } from "@supabase/supabase-js";

import { signedInRecently } from "../../../src/features/profile/schema-reauth.ts";

import { json, SUPABASE_URL } from "../_shared/env.ts";
import { adminClient } from "../_shared/reminders.ts";

const BUCKETS = ["wish-images", "avatars"];

/** Every file under "<user id>/" in a bucket (folders one level deep). */
async function removeFolder(db: ReturnType<typeof adminClient>, bucket: string, userId: string) {
  for (let round = 0; round < 50; round++) {
    const { data, error } = await db.storage.from(bucket).list(userId, { limit: 100 });
    if (error) throw new Error(`list ${bucket}: ${error.message}`);
    if (!data?.length) return;
    const removed = await db.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`));
    if (removed.error) throw new Error(`remove ${bucket}: ${removed.error.message}`);
  }
}

function publishableKey(): string {
  const keys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>;
      const first = parsed.default ?? Object.values(parsed)[0];
      if (first) return first;
    } catch {
      // fall through
    }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const header = req.headers.get("Authorization") ?? "";
  const jwt = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!jwt) return json({ error: "unauthorized" }, 401);

  try {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    const db = adminClient();

    // Who's asking: the verified token (signature and expiry), and its amr.
    const { data: claimsData, error: claimsError } = await db.auth.getClaims(jwt);
    const claims = claimsData?.claims;
    const userId = typeof claims?.sub === "string" ? claims.sub : null;
    if (claimsError || !userId) return json({ error: "unauthorized" }, 401);
    const { data: userData, error: userError } = await db.auth.admin.getUserById(userId);
    const user = userData?.user;
    if (userError || !user?.email) return json({ error: "unauthorized" }, 401);

    const typed = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (typed !== user.email.toLowerCase()) return json({ error: "email_mismatch" }, 400);

    const providers = (user.identities ?? []).map((i) => i.provider);
    if (providers.includes("email")) {
      const password = typeof body.password === "string" ? body.password : "";
      if (!password) return json({ error: "wrong_password" }, 400);
      const probe = createClient(SUPABASE_URL, publishableKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await probe.auth.signInWithPassword({ email: user.email, password });
      if (error) return json({ error: "wrong_password" }, 400);
      await probe.auth.signOut({ scope: "local" });
    } else if (!signedInRecently(claims?.amr, Math.floor(Date.now() / 1000))) {
      return json({ error: "sign_in_again" }, 403);
    }

    const prepared = await db.rpc("prepare_account_deletion", { p_user_id: userId });
    if (prepared.error) throw new Error(prepared.error.message);
    for (const bucket of BUCKETS) await removeFolder(db, bucket, userId);
    const { error: deleteError } = await db.auth.admin.deleteUser(userId);
    if (deleteError) throw new Error(deleteError.message);

    console.log(JSON.stringify({ job: "delete-account", ok: true }));
    return json({ ok: true });
  } catch (error) {
    console.error("delete-account failed:", error instanceof Error ? error.message : "unknown");
    return json({ error: "failed" }, 500);
  }
});
