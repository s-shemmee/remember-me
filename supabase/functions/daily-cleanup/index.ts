/**
 * daily-cleanup: called by pg_cron at 02:30 UTC (Authorization: Bearer
 * CRON_SECRET). run_cleanup() deletes the rows (tested in pgTAP) and returns
 * the photos of deleted wishes, which only the Storage API can remove.
 */
import { isCron, json } from "../_shared/env.ts";
import { adminClient } from "../_shared/reminders.ts";

const BUCKET = "wish-images";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isCron(req)) return json({ error: "unauthorized" }, 401);
  try {
    const db = adminClient();
    const { data, error } = await db.rpc("run_cleanup");
    if (error) throw new Error(error.message);
    const result = data as Record<string, unknown> & { image_paths?: string[] };
    const paths = (result.image_paths ?? []).filter((p) => typeof p === "string");
    let images = 0;
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const removed = await db.storage.from(BUCKET).remove(chunk);
      if (removed.error)
        console.error("daily-cleanup: storage remove failed:", removed.error.message);
      else images += chunk.length;
    }
    const summary = { ...result, image_paths: undefined, images };
    console.log(JSON.stringify({ job: "daily-cleanup", ...summary }));
    return json(summary);
  } catch (error) {
    console.error("daily-cleanup failed:", error instanceof Error ? error.message : "unknown");
    return json({ error: "failed" }, 500);
  }
});
