import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { analyticsBeforeSend, optedOut, scrubAnalyticsUrl } from "./analytics";

/**
 * No token, ID or query string ever reaches Vercel Web Analytics. The
 * <Analytics> component is mocked to capture the `beforeSend` our app really
 * passes, then fed every kind of address that carries a secret in this app.
 */
const captured: { beforeSend?: (e: { type: "pageview"; url: string }) => unknown } = {};
vi.mock("@vercel/analytics/next", () => ({
  Analytics: (props: typeof captured) => {
    captured.beforeSend = props.beforeSend;
    return null;
  },
}));

const SITE = "https://app.example.com";
const UUID = "1f0e0000-0000-4000-8000-000000000001";
const INVITE = "q9X_kR2vLm8TzA1bYc3dEf4GhIj5KlMn"; // like create_invite()'s tokens
const HASH = "pkce_c8fdc4306aaa2e989fbb7a96b5f5ed8508569de81788cf9d5aaaf24d";
const SECRETS = [UUID, INVITE, HASH, "token_hash", "type=", "code=", "next=", "?", "#", "@"];

const CASES: [string, string][] = [
  [`${SITE}/`, `${SITE}/`],
  [`${SITE}/privacy#cookies`, `${SITE}/privacy`],
  [`${SITE}/invite/${INVITE}`, `${SITE}/invite/[token]`],
  [`${SITE}/invite/${INVITE}/start`, `${SITE}/invite/[token]/start`],
  [`${SITE}/invite/short`, `${SITE}/invite/[token]`],
  [`${SITE}/auth/confirm?token_hash=${HASH}&type=email&next=/home`, `${SITE}/auth/confirm`],
  [`${SITE}/auth/callback?code=abc123def456&next=%2Fhome`, `${SITE}/auth/callback`],
  [`${SITE}/reset-password?code=${HASH}`, `${SITE}/reset-password`],
  [`${SITE}/unsubscribe?token=${INVITE}.${HASH}`, `${SITE}/unsubscribe`],
  [`${SITE}/people?person=${UUID}`, `${SITE}/people`],
  [`${SITE}/people/${UUID}`, `${SITE}/people/[id]`],
  [`${SITE}/people/${UUID.toUpperCase()}/plan`, `${SITE}/people/[id]/plan`],
  [`${SITE}/wishlists?tab=friends&friend=${UUID}`, `${SITE}/wishlists`],
  [`${SITE}/settings#reminders`, `${SITE}/settings`],
  [`${SITE}/check-email/someone%40example.com`, `${SITE}/check-email/[email]`],
  [`${SITE}/x/${HASH}`, `${SITE}/x/[token]`],
  [`${SITE}/home`, `${SITE}/home`],
  [`${SITE}/celebrate`, `${SITE}/celebrate`],
];

describe("analytics: no tokens, IDs or query strings", () => {
  it.each(CASES)("%s → %s", (input, expected) => {
    expect(scrubAnalyticsUrl(input)).toBe(expected);
  });

  it("the beforeSend our app passes to <Analytics> scrubs every address", async () => {
    const { SiteAnalytics } = await import("@/components/site-analytics");
    render(<SiteAnalytics />);
    expect(captured.beforeSend).toBe(analyticsBeforeSend);
    for (const [input] of CASES) {
      const sent = captured.beforeSend!({ type: "pageview", url: input }) as { url: string };
      const path = sent.url.slice(SITE.length);
      for (const secret of SECRETS)
        expect(path, `${input} leaked "${secret}"`).not.toContain(secret);
    }
  });

  it("whatever the token looks like, it never survives", () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    for (let n = 0; n < 200; n++) {
      const len = 16 + (n % 40);
      let token = String(n % 10);
      while (token.length < len) token += alphabet[(n * 31 + token.length * 17) % alphabet.length];
      for (const url of [
        `${SITE}/invite/${token}`,
        `${SITE}/somewhere/${token}`,
        `${SITE}/people?id=${token}`,
        `${SITE}/a/${crypto.randomUUID()}/b`,
      ]) {
        const out = scrubAnalyticsUrl(url);
        expect(out).not.toContain(token);
        expect(out).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
      }
    }
  });

  it("keeps the event type, and a broken address becomes /", () => {
    expect(analyticsBeforeSend({ type: "event", url: `${SITE}/people?person=${UUID}` })).toEqual({
      type: "event",
      url: `${SITE}/people`,
    });
    expect(scrubAnalyticsUrl("not a url")).toBe("/");
  });

  it("Global Privacy Control or Do Not Track: the visit isn't counted at all", () => {
    expect(optedOut({ globalPrivacyControl: true })).toBe(true);
    expect(optedOut({ doNotTrack: "1" })).toBe(true);
    expect(optedOut({ doNotTrack: "0" })).toBe(false);
    expect(optedOut({})).toBe(false);
    // jsdom has neither property: define it, check, then remove it again.
    Object.defineProperty(navigator, "globalPrivacyControl", { value: true, configurable: true });
    expect(analyticsBeforeSend({ type: "pageview", url: `${SITE}/home` })).toBeNull();
    Reflect.deleteProperty(navigator, "globalPrivacyControl");
    expect(analyticsBeforeSend({ type: "pageview", url: `${SITE}/home` })).not.toBeNull();
  });

  it("is only rendered on Vercel (the root layout checks VERCEL)", async () => {
    const { readFileSync } = await import("node:fs");
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toMatch(/process\.env\.VERCEL \? <SiteAnalytics \/> : null/);
  });
});
