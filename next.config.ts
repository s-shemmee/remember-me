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

// Set on Vercel (Production + Preview). Absent in CI and most local builds:
// then the build skips the source map upload instead of failing.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default withSentryConfig(nextConfig, {
  org: "shemmee",
  project: "remember-me-os",

  authToken: sentryAuthToken,
  sourcemaps: {
    // "disable-upload" still injects debug IDs, so maps can be uploaded later.
    disable: sentryAuthToken ? false : "disable-upload",
  },

  // Quiet locally, verbose in CI
  silent: !process.env.CI,

  // Better stack traces (slightly slower builds)
  widenClientFileUpload: true,

  // Send browser errors through our own domain so ad blockers don't drop them.
  // Keep "/monitoring" out of the middleware/proxy matcher when we add auth.
  tunnelRoute: "/monitoring",
});
