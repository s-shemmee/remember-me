import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), withScope: vi.fn() }));

const { authErrorReport, isEmailSendFailure } = await import("./auth-errors");

describe("email sending failures", () => {
  it("recognises the built-in sender's refusal and mail server errors", () => {
    expect(isEmailSendFailure({ code: "email_address_not_authorized", status: 400 })).toBe(true);
    expect(isEmailSendFailure({ status: 500, message: "Error sending confirmation email" })).toBe(
      true,
    );
    expect(isEmailSendFailure({ status: 500, message: "Error sending email change email" })).toBe(
      true,
    );
    expect(isEmailSendFailure({ code: "unexpected_failure", message: "Database error" })).toBe(
      false,
    );
  });
});

describe("what a report holds", () => {
  it("the action, code and status, never the message", () => {
    const report = authErrorReport("sign_up", {
      code: "email_address_not_authorized",
      status: 400,
      message: 'Email address "sara@test.local" cannot be used',
    });
    expect(report).toEqual({
      message: "Auth: sign_up failed (email_address_not_authorized)",
      tags: { auth_action: "sign_up", supabase_code: "email_address_not_authorized" },
      context: { status: 400 },
      fingerprint: ["auth", "sign_up", "email_address_not_authorized"],
    });
    expect(JSON.stringify(report)).not.toContain("sara");
  });

  it("no code: 'unknown'", () => {
    expect(authErrorReport("log_in", { status: 502 }).tags.supabase_code).toBe("unknown");
  });
});
