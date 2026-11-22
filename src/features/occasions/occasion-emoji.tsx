import { cn } from "@/lib/utils";

import { OCCASION_TYPES, type OccasionKind } from "./types";

/** The emoji for a day: its kind's (OCCASION_TYPES), ✨ for your own, 🕊️ for a gentle one. */
export const occasionEmoji = (kind: OccasionKind, isYou = false, gentle = false) =>
  isYou ? "✨" : gentle ? "🕊️" : OCCASION_TYPES[kind].emoji;

/**
 * A day's emoji next to its title (People, Calendar, Home). Decorative: the
 * text beside it always says what kind of day it is (docs/design/DESIGN.md).
 */
export function OccasionEmoji({
  kind,
  isYou = false,
  gentle = false,
  className,
}: {
  kind: OccasionKind;
  /** Your own day (Celebrate Me). */
  isYou?: boolean;
  /** A gentle day (Remembrance, or someone "In memory"). */
  gentle?: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn("shrink-0 leading-none", className)}>
      {occasionEmoji(kind, isYou, gentle)}
    </span>
  );
}
