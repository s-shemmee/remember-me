/// <reference lib="esnext" />
/// <reference lib="webworker" />
/**
 * The service worker (Serwist), built by src/app/serwist/[path]/route.ts.
 *
 * Caches only the app shell and static files (src/features/pwa/cache-rules.ts):
 * never page HTML, RSC payloads, /api, Supabase or anything private. Pages
 * are network-only; offline, they fall back to the precached /offline page.
 *
 * Serwist's listeners are attached one by one on purpose: its `message`
 * listener (CACHE_URLS) would let a page ask the worker to cache any URL,
 * so it isn't added.
 *
 * Push: shows the notification from the payload and opens its same-origin
 * page on click (src/features/pwa/push-message.ts).
 */
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  type PrecacheEntry,
  Serwist,
  type SerwistGlobalConfig,
} from "serwist";

import { isCacheable, OFFLINE_PATH, precacheable } from "../features/pwa/cache-rules";
import { parsePush, safePath } from "../features/pwa/push-message";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const origin = self.location.origin;

const serwist = new Serwist({
  precacheEntries: (self.__SW_MANIFEST ?? []).filter((entry) => precacheable(entry, origin)),
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ request, url }) =>
        isCacheable({ url, origin, method: request.method, headers: request.headers }),
      handler: new CacheFirst({
        cacheName: "static",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    // Pages always come from the network (they hold personal data).
    { matcher: ({ request }) => request.mode === "navigate", handler: new NetworkOnly() },
  ],
  fallbacks: {
    entries: [{ url: OFFLINE_PATH, matcher: ({ request }) => request.destination === "document" }],
  },
});

self.addEventListener("install", serwist.handleInstall);
self.addEventListener("activate", serwist.handleActivate);
self.addEventListener("fetch", serwist.handleFetch);

self.addEventListener("push", (event) => {
  const { title, options } = parsePush(event.data?.text());
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: unknown } | null;
  const url = new URL(safePath(data?.url), origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === origin);
      if (open) {
        await open.navigate(url).catch(() => undefined);
        return open.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
