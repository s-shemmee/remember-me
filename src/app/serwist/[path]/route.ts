import { createSerwistRoute } from "@serwist/turbopack";

/**
 * Builds and serves the service worker at /serwist/sw.js (scope "/", via
 * the Service-Worker-Allowed header). The offline page is precached with
 * the deploy's commit, so a new deploy refreshes it.
 */
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    additionalPrecacheEntries: [{ url: "/offline", revision }],
    swSrc: "src/sw/sw.ts",
    useNativeEsbuild: true,
  },
);
