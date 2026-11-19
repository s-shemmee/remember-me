/**
 * Every icon of Remember Me, from the one mark in src/lib/logo-mark.ts (a
 * white heart in a rounded red square). `pnpm icons` renders these files;
 * e2e/logo.spec.ts renders each spec again and compares it, pixel by pixel,
 * with the committed file, so a stale or foreign icon (like the template's
 * Next.js favicon) fails.
 *
 * Pure: SVG strings only. Shapes:
 * - "rounded": the logo as in the app (radius 10/32 of the side), transparent corners;
 * - "square":  full-bleed red, for platforms that round or mask it themselves
 *              (Apple touch icon; maskable PWA icons keep the heart inside the safe zone);
 * - "none":    just the white heart on transparent (Android's notification badge).
 */
import { HEART_PATH, HEART_SCALE, HEART_VIEWBOX, LOGO_RED } from "../../src/lib/logo-mark.ts";

export type IconShape = "rounded" | "square" | "none";
export type IconSpec = {
  /** Repo path of the file. */
  file: string;
  /** Pixels (width = height). */
  size: number;
  shape: IconShape;
  /** The heart's width as a share of the side. */
  heart: number;
};

/** The app's rounded-chip radius (10px on the 32px logo square). */
export const RADIUS = 10 / 32;
/** Maskable icons: the heart stays inside the 80% safe circle, with room. */
const MASKABLE_HEART = 0.4;
/** The badge is drawn by Android in one colour: the heart alone, larger. */
const BADGE_HEART = 0.75;

/** The mark as SVG markup, `size` user units square (the root sets width/height when given). */
export function iconSvg(shape: IconShape, heart: number, size: number, withSize = true): string {
  const h = heart * size;
  const o = (size - h) / 2;
  const fmt = (n: number) => String(Math.round(n * 1000) / 1000);
  const bg =
    shape === "rounded"
      ? `<rect width="${size}" height="${size}" rx="${fmt(size * RADIUS)}" fill="${LOGO_RED}"/>`
      : shape === "square"
        ? `<rect width="${size}" height="${size}" fill="${LOGO_RED}"/>`
        : "";
  const dims = withSize ? ` width="${size}" height="${size}"` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"${dims}>` +
    bg +
    `<svg x="${fmt(o)}" y="${fmt(o)}" width="${fmt(h)}" height="${fmt(h)}" viewBox="${HEART_VIEWBOX}">` +
    `<path fill="#ffffff" d="${HEART_PATH}"/></svg></svg>`
  );
}

/** src/app/icon.svg: the browser tab icon (scales to any size). */
export const ICON_SVG_FILE = "src/app/icon.svg";
export const iconSvgFile = () => iconSvg("rounded", HEART_SCALE, 32, false) + "\n";

/** src/app/favicon.ico: the fallback for browsers without SVG favicons (16 and 32px frames). */
export const FAVICON_FILE = "src/app/favicon.ico";
export const FAVICON_SIZES = [16, 32] as const;

/** Every PNG icon. */
export const PNG_ICONS: IconSpec[] = [
  { file: "public/icons/icon-192.png", size: 192, shape: "rounded", heart: HEART_SCALE },
  { file: "public/icons/icon-512.png", size: 512, shape: "rounded", heart: HEART_SCALE },
  { file: "public/icons/maskable-192.png", size: 192, shape: "square", heart: MASKABLE_HEART },
  { file: "public/icons/maskable-512.png", size: 512, shape: "square", heart: MASKABLE_HEART },
  { file: "public/apple-touch-icon.png", size: 180, shape: "square", heart: HEART_SCALE },
  { file: "public/icons/badge-96.png", size: 96, shape: "none", heart: BADGE_HEART },
  // Emails: 28px at 2×, inside a red cell of the same size (src/features/reminders/email.tsx).
  { file: "public/email/logo.png", size: 56, shape: "rounded", heart: HEART_SCALE },
];

/** A favicon frame as a spec (for rendering and comparing). */
export const faviconSpec = (size: number): IconSpec => ({
  file: `${FAVICON_FILE}#${size}`,
  size,
  shape: "rounded",
  heart: HEART_SCALE,
});

/** An .ico holding PNG frames (supported by every current browser). */
export function packIco(frames: { size: number; png: Uint8Array }[]): Uint8Array {
  const header = 6 + 16 * frames.length;
  const total = header + frames.reduce((n, f) => n + f.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, frames.length, true);
  let offset = header;
  frames.forEach((f, i) => {
    const e = 6 + 16 * i;
    out[e] = f.size >= 256 ? 0 : f.size;
    out[e + 1] = f.size >= 256 ? 0 : f.size;
    view.setUint16(e + 4, 1, true); // colour planes
    view.setUint16(e + 6, 32, true); // bits per pixel
    view.setUint32(e + 8, f.png.length, true);
    view.setUint32(e + 12, offset, true);
    out.set(f.png, offset);
    offset += f.png.length;
  });
  return out;
}

/** The frames of an .ico: size, and whether each holds a PNG (ours) or a bitmap (not ours). */
export function readIco(bytes: Uint8Array): { size: number; png: boolean; data: Uint8Array }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4, true);
  return Array.from({ length: count }, (_, i) => {
    const e = 6 + 16 * i;
    const size = bytes[e] || 256;
    const length = view.getUint32(e + 8, true);
    const offset = view.getUint32(e + 12, true);
    const data = bytes.subarray(offset, offset + length);
    const png = data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
    return { size, png, data };
  });
}
