import "server-only";

/**
 * AI switches (server env, read per request):
 * - AI_ENABLED=true turns AI features on. Off by default: the app works fully
 *   without them (docs/ai.md).
 * - AI_MOCK=1 answers from a fixed script instead of the real providers, for
 *   e2e tests. Ignored on Vercel, so it can never reach real users.
 */
export const aiEnabled = () => process.env.AI_ENABLED === "true";
export const aiMock = () => process.env.AI_MOCK === "1" && !process.env.VERCEL;
/**
 * AI_GIFT_IDEAS_ENABLED=true turns on Noor's gift ideas, on its own switch
 * (so Ask Noor can stay on while gift ideas are off, and the other way round).
 */
export const giftIdeasEnabled = () => process.env.AI_GIFT_IDEAS_ENABLED === "true";
