// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { EXTENSION_URLS, scrubAuthEvent } from "@/lib/sentry-filters";

Sentry.init({
  dsn: "https://30c8ce5e6c1ca778145af4673c48275a@o4512376138891264.ingest.de.sentry.io/4512376148262992",

  // Errors thrown by browser extensions aren't ours.
  denyUrls: EXTENSION_URLS,

  // Auth reports carry the Supabase code and status only: no request data.
  beforeSend: (event) => scrubAuthEvent(event),

  // Session Replay is added once the page is idle (below), not bundled here:
  // it's about 500 KB of script, and parsing it up front cost the landing
  // page its Lighthouse performance budget on mobile.
  integrations: [],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

/**
 * Loads Session Replay from Sentry's CDN on the visitor's first interaction
 * (pointer, key or scroll), or after 15 seconds, so it never competes with
 * the first paint or the first input. The sample rates above apply once it's
 * added. If it can't load (offline, a blocker), the app runs without replays.
 */
function loadReplayLater() {
  const events = ["pointerdown", "keydown", "scroll"] as const;
  let done = false;
  const load = () => {
    if (done) return;
    done = true;
    for (const e of events) window.removeEventListener(e, load);
    Sentry.lazyLoadIntegration("replayIntegration")
      .then((replayIntegration) => Sentry.addIntegration(replayIntegration()))
      .catch(() => {});
  };
  for (const e of events) window.addEventListener(e, load, { once: true, passive: true });
  setTimeout(load, 15_000);
}
loadReplayLater();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
