import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Optional hosted-build settings. Without an upload token, builds skip
// source-map uploads.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  authToken: sentryAuthToken,
  sourcemaps: {
    // "disable-upload" still injects debug IDs, so maps can be uploaded later.
    disable: sentryAuthToken ? false : "disable-upload",
  },

  // Quiet locally, verbose in CI
  silent: !process.env.CI,

  // Better stack traces (slightly slower builds)
  widenClientFileUpload: true,

  // Smaller browser bundle: no Sentry debug logging, and no Session Replay
  // code paths (we don't use Replay at all).
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },

  // Send browser errors through our own domain so ad blockers don't drop them.
  // Keep "/monitoring" out of the middleware/proxy matcher when we add auth.
  tunnelRoute: "/monitoring",
});
