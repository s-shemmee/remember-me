// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { SENTRY_DATA_COLLECTION, scrubAuthEvent } from "@/lib/sentry-filters";

Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  enabled: Boolean(process.env.SENTRY_DSN),

  // Auth reports carry the Supabase code and status only: no request data.
  beforeSend: (event) => scrubAuthEvent(event),

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // No personal data: no user details, cookies, headers, bodies or query
  // strings (the Privacy Policy says so).
  dataCollection: SENTRY_DATA_COLLECTION,
});
