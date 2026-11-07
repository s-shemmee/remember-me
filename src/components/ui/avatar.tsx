import * as React from "react";

import type { Pastel } from "@/styles/tokens";
import { cn } from "@/lib/utils";

import { pastelClasses } from "./chip";

/** Up to two initials from a name: "Grandma Fatima" → "GF", "Omar" → "O". */
/**
 * Two letters, as in the approved screens: first and last word's initials
 * ("Grandma Fatima" → "GF", "Mom & Dad" → "MD"), or the first two letters of
 * a single name ("Khalid" → "KH", "Sara" → "SA"). Symbols like "&" are skipped.
 */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w));
  const first = words[0];
  if (!first) return "";
  if (words.length === 1) return Array.from(first).slice(0, 2).join("").toUpperCase();
  const last = words.at(-1) ?? "";
  return `${Array.from(first)[0] ?? ""}${Array.from(last)[0] ?? ""}`.toUpperCase();
}

const sizes = {
  sm: "size-9 text-13",
  md: "size-12 text-17",
  lg: "size-16 text-22",
  xl: "size-24 text-34",
} as const;

/**
 * Person avatar: a circle in the person's pastel, initials in its ink at 800.
 * With `src`, shows the photo instead. The name is the accessible label;
 * pass `decorative` when the name is already shown next to it.
 */
function Avatar({
  name,
  pastel,
  src,
  size = "md",
  decorative = false,
  className,
}: {
  name: string;
  pastel: Pastel;
  src?: string | null;
  size?: keyof typeof sizes;
  decorative?: boolean;
  className?: string;
}) {
  const label = decorative ? undefined : name;
  return (
    <span
      data-slot="avatar"
      role={decorative ? undefined : "img"}
      aria-label={label}
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-pill leading-none font-extrabold tracking-heading select-none",
        sizes[size],
        pastelClasses[pastel],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatars come from signed Storage URLs; sized by the circle
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initialsOf(name)}</span>
      )}
    </span>
  );
}

export { Avatar };
