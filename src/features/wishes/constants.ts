/** Wishes (docs/data-model.md): limits mirror the database checks. */

export const WISH_TITLE_MAX = 80;
export const WISH_NOTE_MAX = 280;
export const WISH_URL_MAX = 2048;

export const CURRENCIES = ["MAD", "EUR", "USD", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PRIORITIES = [
  { key: "love", label: "Love it", emoji: "💖" },
  { key: "like", label: "Like it", emoji: "🙂" },
  { key: "nice", label: "Nice to have", emoji: "✨" },
] as const;
export type Priority = (typeof PRIORITIES)[number]["key"];

export const WISH_IMAGES_BUCKET = "wish-images";
/** The bucket's limit; photos are shrunk in the browser to fit. */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
/** Longest side after shrinking. */
export const IMAGE_MAX_SIDE = 1600;
/** What people may pick (decoded and re-encoded to WebP before upload). */
export const IMAGE_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** A very large original is refused before we even try to decode it. */
export const IMAGE_INPUT_MAX_BYTES = 20 * 1024 * 1024;

/** "<user id>/<random>.webp": the only shape the database accepts. */
export const IMAGE_PATH_RE = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(webp|jpg|jpeg|png)$/;
