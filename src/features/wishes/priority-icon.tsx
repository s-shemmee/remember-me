import { HeartIcon, SparklesIcon, ThumbsUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PRIORITIES } from "./constants";

const ICONS = { love: HeartIcon, like: ThumbsUpIcon, nice: SparklesIcon } as const;

/** "Love it", "Like it", "Nice to have": an icon, never an emoji (the label says it). */
export function PriorityIcon({
  priority,
  className,
}: {
  priority: (typeof PRIORITIES)[number]["key"];
  className?: string;
}) {
  const Icon = ICONS[priority];
  return <Icon aria-hidden className={cn("size-4 shrink-0", className)} />;
}
