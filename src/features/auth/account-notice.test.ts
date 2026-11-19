import { describe, expect, it, vi } from "vitest";

import { FAKE_ACCOUNT_NOTICE_SECRET, FAKE_EMAIL_HASH_SECRET } from "@/test/fake-values";

import { ACCOUNT_EXISTS_SUBJECT, renderAccountExistsEmail } from "./account-exists-email";
import { emailHash, isNoticeCaller, noticeEmail } from "./account-notice";

vi.mock("server-only", () => ({}));

describe("account-notice: only our Next server may call it", () => {
  const secret = FAKE_ACCOUNT_NOTICE_SECRET;

  it("accepts exactly `Bearer <ACCOUNT_NOTICE_SECRET>`", () => {
    expect(isNoticeCaller(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("refuses a direct call without it, or with anything else", () => {
    expect(isNoticeCaller(null, secret)).toBe(false);
    expect(isNoticeCaller("", secret)).toBe(false);
    expect(isNoticeCaller("Bearer ", secret)).toBe(false);
    expect(isNoticeCaller(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isNoticeCaller(secret, secret)).toBe(false);
    // The publishable key (what a browser could send) is never enough.
    expect(isNoticeCaller("Bearer sb_publishable_test_00000000", secret)).toBe(false);
  });

  it("refuses everything when the secret isn't set or is too short", () => {
    expect(isNoticeCaller("Bearer ", "")).toBe(false);
    expect(isNoticeCaller("Bearer short", "short")).toBe(false);
  });
});

describe("account-notice: the address", () => {
  it("takes a plausible address, trimmed", () => {
    expect(noticeEmail({ email: "  sara@test.local " })).toBe("sara@test.local");
    expect(noticeEmail({ email: "not an email" })).toBeNull();
    expect(noticeEmail({})).toBeNull();
    expect(noticeEmail(null)).toBeNull();
    expect(noticeEmail({ email: `${"a".repeat(250)}@x.io` })).toBeNull();
  });

  it("logs an HMAC (case and spaces don't matter), never the address", async () => {
    const a = await emailHash(FAKE_EMAIL_HASH_SECRET, "Sara@Test.local");
    const b = await emailHash(FAKE_EMAIL_HASH_SECRET, "  sara@test.local ");
    expect(a).toBe(b);
    expect(a).toMatch(/^\\x[0-9a-f]{64}$/);
    expect(a).not.toContain("sara");
    // A different key gives a different hash: it can't be reversed by guessing addresses.
    expect(await emailHash(`${FAKE_EMAIL_HASH_SECRET}x`, "sara@test.local")).not.toBe(a);
  });
});

describe("the account-exists email", () => {
  it("has Log in and Reset password, our footer, and nothing about who asked", async () => {
    const email = await renderAccountExistsEmail("https://app.example");
    expect(email.subject).toBe(ACCOUNT_EXISTS_SUBJECT);
    expect(email.html).toContain('href="https://app.example/log-in"');
    expect(email.html).toContain('href="https://app.example/forgot-password"');
    expect(email.html).toContain("Signed up with Google? Use Continue with Google");
    expect(email.html).toContain("mailto:contact@shemme.codes");
    expect(email.html).not.toContain("Unsubscribe");
    expect(email.text).toContain("You already have an account");
    // The only image is the logo (no tracking pixels), alt="" in a red cell.
    expect(email.html.match(/<img[^>]*>/g)).toEqual([
      expect.stringMatching(/src="[^"]*\/email\/logo\.png"[^>]*alt=""/),
    ]);
  });
});

describe("the server-only secret", () => {
  it("is read from the server env, at least 32 characters, never NEXT_PUBLIC_", async () => {
    const { accountNoticeSecret } = await import("@/lib/account-notice");
    expect(accountNoticeSecret({ ACCOUNT_NOTICE_SECRET: FAKE_ACCOUNT_NOTICE_SECRET })).toBe(
      FAKE_ACCOUNT_NOTICE_SECRET,
    );
    expect(accountNoticeSecret({ ACCOUNT_NOTICE_SECRET: "short" })).toBeNull();
    expect(accountNoticeSecret({})).toBeNull();
    expect(
      accountNoticeSecret({ NEXT_PUBLIC_ACCOUNT_NOTICE_SECRET: FAKE_ACCOUNT_NOTICE_SECRET }),
    ).toBeNull();
  });
});
