import { describe, expect, it } from "vitest";

import {
  expiresLabel,
  inviteCopy,
  inviteErrorStatus,
  type InviteStatus,
  isInviteToken,
} from "./invite-token";

describe("invite tokens", () => {
  it("are 64 hex characters, nothing else", () => {
    expect(isInviteToken("a".repeat(64))).toBe(true);
    expect(isInviteToken("A".repeat(64))).toBe(false);
    expect(isInviteToken("a".repeat(63))).toBe(false);
    expect(isInviteToken("../../etc")).toBe(false);
    expect(isInviteToken(undefined)).toBe(false);
  });
});

describe("invite states", () => {
  it("says something clear for every state", () => {
    const states: InviteStatus[] = [
      "valid",
      "expired",
      "used",
      "revoked",
      "not_found",
      "own",
      "connected",
    ];
    expect(states.map((s) => inviteCopy(s, "Amina").title)).toEqual([
      "Amina invited you to connect",
      "This invite has expired",
      "This invite has already been used",
      "This invite was cancelled",
      "I can't find this invite",
      "This is your own invite",
      "You're already connected with Amina",
    ]);
    expect(inviteCopy("expired", "Amina").body).toBe(
      "Invites last 7 days. Ask Amina for a new link.",
    );
    expect(inviteCopy("used", null).body).toBe("Each link works once. Ask them for a new one.");
    expect(inviteCopy("valid", null).title).toBe("Someone invited you to connect");
  });

  it("maps accept_invite() errors to states", () => {
    expect(inviteErrorStatus("invite_expired")).toBe("expired");
    expect(inviteErrorStatus("invite_used")).toBe("used");
    expect(inviteErrorStatus("invite_revoked")).toBe("revoked");
    expect(inviteErrorStatus("invite_not_found")).toBe("not_found");
    expect(inviteErrorStatus("own_invite")).toBe("own");
    expect(inviteErrorStatus("already_connected")).toBe("connected");
    expect(inviteErrorStatus("boom")).toBeNull();
  });

  it("counts the days left", () => {
    const now = Date.parse("2026-11-10T12:00:00Z");
    expect(expiresLabel("2026-11-17T12:00:00Z", now)).toBe("Expires in 7 days");
    expect(expiresLabel("2026-11-12T13:00:00Z", now)).toBe("Expires in 3 days");
    expect(expiresLabel("2026-11-11T11:00:00Z", now)).toBe("Expires within a day");
  });
});
