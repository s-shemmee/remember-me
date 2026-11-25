/**
 * What the service worker may keep.
 *
 * Only the app shell and static files: build assets, icons, the manifest
 * and the offline page. Never page HTML or RSC payloads (they carry people,
 * wishes and reservations), never /api or Server Actions, never anything
 * from another origin (Supabase, signed photo URLs), never a POST. Nothing
 * private stays on a shared device.
 *
 * Pure (no worker globals) so it's unit-tested and bundled into the worker.
 */

export const OFFLINE_PATH = "/offline";

const STATIC_PREFIXES = ["/_next/static/", "/icons/"];
const STATIC_FILES = new Set([
  OFFLINE_PATH,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon.svg",
  "/apple-touch-icon.png",
]);
const NEVER_PREFIXES = ["/api/", "/auth/", "/serwist/", "/_next/image", "/_next/data/"];

export type CacheCheck = {
  url: URL;
  /** The service worker's own origin. */
  origin: string;
  method: string;
  headers?: { get(name: string): string | null };
};

/** Whether a request may be served from, or stored in, the cache. */
export function isCacheable({ url, origin, method, headers }: CacheCheck): boolean {
  if (method !== "GET") return false;
  if (url.origin !== origin) return false;
  // RSC payloads (client navigations and prefetches): personal data.
  if (url.searchParams.has("_rsc")) return false;
  if (
    headers?.get("RSC") ||
    headers?.get("Next-Router-State-Tree") ||
    headers?.get("Next-Action")
  ) {
    return false;
  }
  const path = url.pathname;
  if (NEVER_PREFIXES.some((p) => path.startsWith(p))) return false;
  if (STATIC_FILES.has(path)) return true;
  return STATIC_PREFIXES.some((p) => path.startsWith(p));
}

/** Precache entries from the build, filtered by the same rules. */
export function precacheable(entry: string | { url: string }, origin: string): boolean {
  const raw = typeof entry === "string" ? entry : entry.url;
  try {
    return isCacheable({ url: new URL(raw, origin), origin, method: "GET" });
  } catch {
    return false;
  }
}
