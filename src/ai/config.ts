import "server-only";

/**
 * Ask Noor is optional and off by default. AI_MOCK provides scripted responses
 * for tests and is ignored on hosted deployments.
 * - AI_MOCK=1 answers from a fixed script instead of the real providers, for
 *   e2e tests. Ignored on Vercel, so it can never reach real users.
 */
export const aiEnabled = () => process.env.AI_ENABLED === "true";
export const aiMock = () => process.env.AI_MOCK === "1" && !process.env.VERCEL;
