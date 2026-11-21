import "server-only";

/**
 * Product switches (server env, read per request; off unless set to "true").
 * - NOTIFICATIONS_INBOX_ENABLED: the notification bell in page headers. Off,
 *   the bell isn't rendered at all (no empty gap).
 */
export const notificationsInboxEnabled = () => process.env.NOTIFICATIONS_INBOX_ENABLED === "true";
