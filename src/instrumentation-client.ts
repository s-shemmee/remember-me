// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { EXTENSION_URLS, SENTRY_DATA_COLLECTION, scrubAuthEvent } from "@/lib/sentry-filters";

Sentry.init({
  dsn: "https://30c8ce5e6c1ca778145af4673c48275a@o4512376138891264.ingest.de.sentry.io/4512376148262992",


  // Errors thrown by browser extensions aren't ours.
  denyUrls: EXTENSION_URLS,

  // Auth reports carry the Supabase code and status only: no request data.
  beforeSend: (event) => scrubAuthEvent(event),

  // No Session Replay, ever (docs/decisions.md): no Replay integration, not
  // even lazy-loaded from Sentry's CDN, and no replay sample rates. The default
  // integrations leave it out. src/instrumentation-client.test.ts checks this.
  integrations: [],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // No personal data: no user details, cookies, headers, bodies or query
  // strings (the Privacy Policy says so).
  dataCollection: SENTRY_DATA_COLLECTION,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
