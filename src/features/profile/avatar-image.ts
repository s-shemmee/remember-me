"use client";

import { checkImageFile } from "@/features/wishes/image";

import { AVATAR_SIDE } from "./constants";

export { checkImageFile };

/** The centred square of an image (what a round avatar shows). */
export function squareCrop(width: number, height: number) {
  const side = Math.min(width, height);
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side };
}

export type PreparedAvatar = { blob: Blob; type: "image/webp" | "image/jpeg"; ext: "webp" | "jpg" };

/**
 * Crops a photo to a centred square, shrinks it to 512px and re-encodes it
 * (WebP; JPEG where the browser can't encode WebP, like Safari). Drawing to
 * a canvas keeps only the pixels: EXIF and GPS never leave the device.
 */
export async function prepareAvatar(file: File): Promise<PreparedAvatar> {
  const bitmap = await createImageBitmap(file);
  const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height);
  const size = Math.min(AVATAR_SIDE, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();
  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp", 0.86);
  if (webp?.type === "image/webp") return { blob: webp, type: "image/webp", ext: "webp" };
  const jpeg = await encode("image/jpeg", 0.86);
  if (!jpeg) throw new Error("encode_failed");
  return { blob: jpeg, type: "image/jpeg", ext: "jpg" };
}
