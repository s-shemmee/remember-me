import {
  IMAGE_INPUT_MAX_BYTES,
  IMAGE_INPUT_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_SIDE,
} from "./constants";

export type ImageCheck = { ok: true } | { ok: false; message: string };

/** Before decoding: an image type we accept, and not absurdly large. */
export function checkImageFile(file: { type: string; size: number }): ImageCheck {
  if (!(IMAGE_INPUT_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, message: "Use a photo: JPEG, PNG or WebP." };
  }
  if (file.size > IMAGE_INPUT_MAX_BYTES) {
    return { ok: false, message: "That photo is too big. Try one under 20 MB." };
  }
  return { ok: true };
}

/** The size to draw at: longest side at most IMAGE_MAX_SIDE, never enlarged. */
export function fitWithin(width: number, height: number, max = IMAGE_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export type PreparedImage = { blob: Blob; type: "image/webp" | "image/jpeg"; ext: "webp" | "jpg" };

/**
 * Shrinks a photo in the browser and re-encodes it (WebP, or JPEG where the
 * browser can't encode WebP, like Safari). Drawing to a canvas keeps only
 * the pixels, so EXIF metadata (GPS location, camera, time) never leaves
 * the device. Lowers the quality until it fits in 2 MB.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  const probe = await encode("image/webp", 0.85);
  const webp = probe?.type === "image/webp";
  const type = webp ? "image/webp" : "image/jpeg";
  for (const quality of [0.85, 0.72, 0.6, 0.45]) {
    const blob = quality === 0.85 && webp ? probe : await encode(type, quality);
    if (blob && blob.size <= IMAGE_MAX_BYTES) {
      return { blob, type, ext: webp ? "webp" : "jpg" };
    }
  }
  throw new Error("too_big");
}
