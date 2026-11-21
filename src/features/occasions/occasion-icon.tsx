import {
  BirdIcon,
  BriefcaseBusinessIcon,
  CakeIcon,
  GraduationCapIcon,
  HeartIcon,
  type LucideIcon,
  SparklesIcon,
  StarIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { OccasionKind } from "./types";

/**
 * Each kind's icon in the app UI (chips, tiles, labels). The emoji in
 * OCCASION_TYPES stay for Noor's messages, emails and push only: no emoji in
 * app UI (docs/design-system.md).
 */
export const OCCASION_ICONS: Record<OccasionKind, LucideIcon> = {
  birthday: CakeIcon,
  anniversary: HeartIcon,
  graduation: GraduationCapIcon,
  work_milestone: BriefcaseBusinessIcon,
  remembrance: BirdIcon,
  other: SparklesIcon,
};

/** Decorative: the text next to it always says what kind of day it is. */
export function OccasionIcon({
  kind,
  isYou = false,
  gentle = false,
  className,
}: {
  kind: OccasionKind;
  /** Your own day: a star (Celebrate Me). */
  isYou?: boolean;
  /** A gentle day (Remembrance, or someone "In memory"): the dove. */
  gentle?: boolean;
  className?: string;
}) {
  const Icon = isYou ? StarIcon : gentle ? BirdIcon : OCCASION_ICONS[kind];
  return <Icon aria-hidden className={cn("size-4 shrink-0", className)} />;
}
