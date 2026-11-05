import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_DB_PASSWORD, FAKE_SUPABASE_URL } from "@/test/fake-values";

const rpcResult = vi.fn();
const captureException = vi.fn();

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonServerClient: () => ({
    rpc: (fn: string) => ({ abortSignal: () => rpcResult(fn) }),
  }),
}));

const { GET } = await import("./route");

// Anything that must never appear in the response body.
const MUST_NOT_LEAK = [
  FAKE_SUPABASE_URL,
  FAKE_DB_PASSWORD,
  "sb_publishable_",
  "sb_secret_",
  "password",
];

async function call() {
  const response = await GET();
  const text = await response.text();
  return { response, text, body: JSON.parse(text) as Record<string, unknown> };
}

beforeEach(() => {
  rpcResult.mockReset();
  captureException.mockReset();
});

describe("GET /api/health", () => {
  it("returns ok with latency when the database answers", async () => {
    rpcResult.mockResolvedValue({ data: true, error: null });
    const { response, body } = await call();

    expect(rpcResult).toHaveBeenCalledWith("health_check");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({ status: "ok", db: "ok", latencyMs: expect.any(Number) });
  });

  it("returns 503 without details when the database errors", async () => {
    rpcResult.mockResolvedValue({
      data: null,
      error: { message: `connect ECONNREFUSED ${FAKE_SUPABASE_URL} password ${FAKE_DB_PASSWORD}` },
    });
    const { response, text, body } = await call();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "error", db: "unreachable" });
    for (const value of MUST_NOT_LEAK) expect(text).not.toContain(value);
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("returns 503 when the call throws (timeout, bad env)", async () => {
    rpcResult.mockRejectedValue(new Error("The operation was aborted due to timeout"));
    const { response, body } = await call();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "error", db: "unreachable" });
  });

  it("treats an unexpected answer as unreachable", async () => {
    rpcResult.mockResolvedValue({ data: false, error: null });
    expect((await call()).response.status).toBe(503);
  });
});
