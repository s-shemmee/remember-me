// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { SENTRY_DATA_COLLECTION, scrubAuthEvent } from "@/lib/sentry-filters";

Sentry.init({
  dsn: "https://30c8ce5e6c1ca778145af4673c48275a@o4512376138891264.ingest.de.sentry.io/4512376148262992",


  // Auth reports carry the Supabase code and status only: no request data.
  beforeSend: (event) => scrubAuthEvent(event),

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // No personal data: no user details, cookies, headers, bodies or query
  // strings (the Privacy Policy says so).
  dataCollection: SENTRY_DATA_COLLECTION,
});
