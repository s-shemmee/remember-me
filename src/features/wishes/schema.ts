import { z } from "zod";

import {
  CURRENCIES,
  IMAGE_PATH_RE,
  WISH_NOTE_MAX,
  WISH_TITLE_MAX,
  WISH_URL_MAX,
} from "./constants";

/** Only http(s) links, never javascript:, data: or anything else. */
export function isWebLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/** "jumia.ma" from "https://www.jumia.ma/…" (shown as the shop). */
export function shopOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** "450", "12.50" or "12,50" → 12.5; empty → null. */
const PRICE_RE = /^\d{1,9}(?:[.,]\d{1,2})?$/;

/**
 * The wish form, mirroring the wishes table. Checked in the dialog, then
 * again in the Server Action before the database sees it.
 */
export const wishFormSchema = z.object({
  id: z.uuid().nullable(),
  wishlistId: z.uuid({ error: "Pick a list." }),
  title: z
    .string()
    .trim()
    .min(1, { error: "What do you wish for?" })
    .max(WISH_TITLE_MAX, { error: `Keep it to ${WISH_TITLE_MAX} characters.` }),
  url: z
    .string()
    .trim()
    .max(WISH_URL_MAX, { error: "That link is too long." })
    .refine((v) => v === "" || isWebLink(v), {
      error: "Use a web link that starts with https://",
    })
    .transform((v) => (v === "" ? null : v)),
  price: z
    .string()
    .trim()
    .refine((v) => v === "" || PRICE_RE.test(v), { error: "Use a price like 450 or 12.50." })
    .transform((v) => (v === "" ? null : Number(v.replace(",", ".")))),
  currency: z.enum(CURRENCIES),
  note: z
    .string()
    .trim()
    .max(WISH_NOTE_MAX, { error: `Keep it to ${WISH_NOTE_MAX} characters.` }),
  priority: z.enum(["love", "like", "nice"]),
  imagePath: z.string().regex(IMAGE_PATH_RE).nullable(),
});

export type WishFormValues = z.input<typeof wishFormSchema>;
export type WishFormData = z.output<typeof wishFormSchema>;

export function wishFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

/** "420 MAD", "12.50 EUR". */
export function formatPrice(amount: number | null, currency: string): string | null {
  if (amount === null) return null;
  const n = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${n} ${currency}`;
}
