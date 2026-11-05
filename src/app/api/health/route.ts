import * as Sentry from "@sentry/nextjs";
import { connection } from "next/server";

import { createSupabaseAnonServerClient } from "@/lib/supabase/server";

const TIMEOUT_MS = 5000;

type Health =
  { status: "ok"; db: "ok"; latencyMs: number } | { status: "error"; db: "unreachable" };

function json(body: Health, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * GET /api/health: is the app up and can it reach the database?
 * Calls public.health_check() (reads no data). The response never includes
 * error details, URLs or keys; failures go to Sentry instead.
 */
export async function GET() {
  // Always run per request (never prerendered at build, never cached).
  await connection();

  const started = performance.now();
  try {
    const supabase = createSupabaseAnonServerClient();
    const { data, error } = await supabase
      .rpc("health_check")
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));

    if (error || data !== true) {
      throw error ?? new Error("health_check() did not return true");
    }
    return json(
      { status: "ok", db: "ok", latencyMs: Math.round(performance.now() - started) },
      200,
    );
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "api/health" } });
    return json({ status: "error", db: "unreachable" }, 503);
  }
}
