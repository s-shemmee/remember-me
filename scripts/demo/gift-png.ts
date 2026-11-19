/**
 * A flat gift-box illustration as a PNG (no dependencies: zlib only), for
 * demo wishes. Never a photo of anyone.
 */
import { crc32, deflateSync } from "node:zlib";

/** The six person pastels and their inks (light theme, globals.css). */
const PALETTE = {
  rose: { bg: [252, 228, 236], ink: [158, 42, 84] },
  sky: { bg: [222, 236, 252], ink: [30, 77, 140] },
  peach: { bg: [255, 232, 214], ink: [150, 66, 20] },
  lilac: { bg: [236, 230, 252], ink: [91, 63, 181] },
  mint: { bg: [220, 244, 232], ink: [24, 102, 70] },
  butter: { bg: [255, 243, 204], ink: [125, 92, 10] },
} as const;

export type GiftColor = keyof typeof PALETTE;

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

/** A `size`×`size` PNG: pastel background, a gift box with a ribbon and bow in the ink colour. */
export function giftPng(color: GiftColor, size = 320): Buffer {
  const { bg, ink } = PALETTE[color];
  const box = [255, 255, 255];
  const s = size / 320;
  const inRect = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) =>
    x >= x0 * s && x < x1 * s && y >= y0 * s && y < y1 * s;
  const inCircle = (x: number, y: number, cx: number, cy: number, r: number) =>
    (x - cx * s) ** 2 + (y - cy * s) ** 2 <= (r * s) ** 2;

  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // no filter
    for (let x = 0; x < size; x++) {
      let c: readonly number[] = bg;
      const bow = inCircle(x, y, 138, 92, 22) || inCircle(x, y, 182, 92, 22);
      const lid = inRect(x, y, 80, 110, 240, 150);
      const body = inRect(x, y, 92, 150, 228, 250);
      if (bow) c = ink;
      if (lid || body) c = box;
      if ((lid || body) && inRect(x, y, 150, 110, 170, 250)) c = ink; // vertical ribbon
      if (body && inRect(x, y, 92, 190, 228, 206)) c = ink; // band
      const o = row + 1 + x * 3;
      raw[o] = c[0]!;
      raw[o + 1] = c[1]!;
      raw[o + 2] = c[2]!;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour (RGB)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
