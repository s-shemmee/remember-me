import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { browserLabel, feedbackEmail, feedbackSchema, FEEDBACK_REPLIES, safeRoute } from "./schema";

describe("feedback: page and device info never carries people, wishes or names", () => {
  it("the route keeps the section only", () => {
    expect(safeRoute("/settings/privacy")).toBe("/settings/privacy");
    expect(safeRoute("/people?person=0b1a6f4e-1111-4111-8111-111111111111")).toBe("/people");
    expect(safeRoute("/people?q=Khalid")).toBe("/people");
    expect(safeRoute("/wishlists?tab=friends&friend=abc")).toBe("/wishlists");
    expect(safeRoute("/invite/secret-token")).toBe("/");
    expect(safeRoute("/people/0b1a6f4e-1111-4111-8111-111111111111")).toBe("/people");
    expect(safeRoute("/help/reminders#top")).toBe("/help/reminders");
    expect(safeRoute("https://evil.example/home")).toBe("/");
  });

  it("the browser is a short label, not the user agent", () => {
    const chrome =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    expect(browserLabel(chrome)).toBe("Chrome 131 on Windows");
    const safari =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
    expect(browserLabel(safari)).toBe("Safari 18 on iOS");
    expect(browserLabel("")).toBe("Another browser on another system");
  });

  it("meta is only browser, screen and a section route; anything else is refused", () => {
    const ok = {
      type: "idea",
      message: "Hi",
      meta: { browser: "Chrome 131 on Windows", screen: "390x844", route: "/home" },
    };
    expect(feedbackSchema.safeParse(ok).success).toBe(true);
    expect(feedbackSchema.safeParse({ ...ok, meta: null }).success).toBe(true);
    expect(feedbackSchema.safeParse({ ...ok, meta: { ...ok.meta, name: "Khalid" } }).success).toBe(
      false,
    );
    expect(
      feedbackSchema.safeParse({ ...ok, meta: { ...ok.meta, route: "/people?q=Khalid" } }).success,
    ).toBe(false);
    expect(feedbackSchema.safeParse({ ...ok, meta: { ...ok.meta, screen: "big" } }).success).toBe(
      false,
    );
  });

  it("the message: 1 to 1000 characters, one of three types", () => {
    const base = { type: "broken", meta: null };
    expect(feedbackSchema.safeParse({ ...base, message: "   " }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, message: "x".repeat(1001) }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, message: "x".repeat(1000) }).success).toBe(true);
    expect(feedbackSchema.safeParse({ ...base, type: "rant", message: "x" }).success).toBe(false);
  });

  it("the email to us escapes the message and says when info was switched off", () => {
    const email = feedbackEmail({
      id: "f1",
      type: "broken",
      message: "<script>alert(1)</script>\nsecond line",
      meta: null,
      createdAt: "2026-11-21T10:00:00Z",
    });
    expect(email.subject).toBe("Feedback: Something's broken · <script>alert(1)</script>");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.text).toContain("No page or device info");
  });
});

// The Server Action ------------------------------------------------------------------------------
const insert = vi.fn();
const invoke = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) },
    from: () => ({ insert }),
    functions: { invoke },
  }),
}));
const { sendFeedback } = await import("./actions");

describe("sendFeedback (Server Action)", () => {
  beforeEach(() => {
    insert.mockReset().mockResolvedValue({ error: null });
    invoke.mockReset().mockResolvedValue({ data: { sent: 1 }, error: null });
  });
  afterEach(() => vi.restoreAllMocks());

  it("validates, saves with your session, then asks the function to email it", async () => {
    await expect(
      sendFeedback({ type: "idea", message: "  A dark calendar  ", meta: null }),
    ).resolves.toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith({ type: "idea", message: "A dark calendar", meta: {} });
    expect(invoke).toHaveBeenCalledWith("send-feedback", { method: "POST", body: {} });
  });

  it("refuses a bad message before saving anything", async () => {
    await expect(sendFeedback({ type: "idea", message: "", meta: null })).resolves.toMatchObject({
      ok: false,
      field: "message",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("the daily limit (5) gets a kind message", async () => {
    insert.mockResolvedValue({ error: { message: "feedback_limit" } });
    await expect(sendFeedback({ type: "idea", message: "six", meta: null })).resolves.toEqual({
      ok: false,
      message: FEEDBACK_REPLIES.limit,
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("a failed email still counts as sent (it's saved; the next send retries it)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    invoke.mockResolvedValue({ data: null, error: { name: "FunctionsFetchError" } });
    await expect(sendFeedback({ type: "other", message: "Hi", meta: null })).resolves.toEqual({
      ok: true,
    });
  });
});
