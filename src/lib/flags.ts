import "server-only";

/**
 * Product switches (server env, read per request; off unless set to "true").
 * - NOTIFICATIONS_INBOX_ENABLED: the notification bell in page headers. Off,
 *   the bell isn't rendered at all (no empty gap).
 */
export const notificationsInboxEnabled = () => process.env.NOTIFICATIONS_INBOX_ENABLED === "true";
/**
 * NOOR_CHAT_ENABLED: Noor's chat panel (docs/roadmap/02-noor-chat.md). It also
 * needs AI_ENABLED (help answers); gift ideas and message drafts inside it
 * follow their own switches. Off by default.
 */
export const noorChatEnabled = () =>
  process.env.NOOR_CHAT_ENABLED === "true" && process.env.AI_ENABLED === "true";
