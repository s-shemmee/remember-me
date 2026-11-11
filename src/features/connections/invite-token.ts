/** Invite tokens are 32 random bytes as 64 hex characters (create_invite()). */
export const INVITE_TOKEN_RE = /^[0-9a-f]{64}$/;
export const isInviteToken = (value: unknown): value is string =>
  typeof value === "string" && INVITE_TOKEN_RE.test(value);

/** Remembers an invite across sign-up, log-in and onboarding (7 days, like the invite). */
export const INVITE_COOKIE = "rm-invite";
export const INVITE_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export type InviteStatus =
  "valid" | "expired" | "used" | "revoked" | "not_found" | "own" | "connected";

/** What the invite page says for each state. */
export function inviteCopy(
  status: InviteStatus,
  name: string | null,
): { title: string; body: string } {
  const who = name || "Someone";
  const them = name ?? "them";
  switch (status) {
    case "valid":
      return {
        title: `${who} invited you to connect`,
        body: "Once you're connected, you'll see each other's shared wishlists and never miss each other's birthday.",
      };
    case "own":
      return {
        title: "This is your own invite",
        body: "Send this link to someone you'd like to connect with.",
      };
    case "connected":
      return { title: `You're already connected with ${who}`, body: "Nothing more to do here 💛" };
    case "expired":
      return {
        title: "This invite has expired",
        body: `Invites last 7 days. Ask ${them} for a new link.`,
      };
    case "used":
      return {
        title: "This invite has already been used",
        body: `Each link works once. Ask ${them} for a new one.`,
      };
    case "revoked":
      return {
        title: "This invite was cancelled",
        body: `Ask ${them} for a new link if you'd like to connect.`,
      };
    default:
      return { title: "I can't find this invite", body: "Check the link, or ask for a new one." };
  }
}

/** accept_invite() errors → the matching state. */
export function inviteErrorStatus(message: string | undefined): InviteStatus | null {
  const map: Record<string, InviteStatus> = {
    invite_not_found: "not_found",
    invite_expired: "expired",
    invite_used: "used",
    invite_revoked: "revoked",
    own_invite: "own",
    already_connected: "connected",
  };
  return message ? (map[message] ?? null) : null;
}

const DAY = 86_400_000;

/** "Expires in 6 days" (rounded up), or "Expires within a day". */
export function expiresLabel(expiresAt: string, now: number): string {
  const days = Math.ceil((new Date(expiresAt).getTime() - now) / DAY);
  return days <= 1 ? "Expires within a day" : `Expires in ${days} days`;
}
