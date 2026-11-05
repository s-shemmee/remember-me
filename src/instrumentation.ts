import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Fail fast at server start if an env var is missing or wrong.
  // SKIP_ENV_VALIDATION is only for the CI build, which runs without secrets.
  if (!process.env.SKIP_ENV_VALIDATION) {
    const { getEnv } = await import("./lib/env");
    getEnv();
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
