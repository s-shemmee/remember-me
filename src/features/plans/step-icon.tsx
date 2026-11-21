import {
  CakeIcon,
  FeatherIcon,
  GiftIcon,
  HouseIcon,
  type LucideIcon,
  MailIcon,
  PhoneIcon,
  SparklesIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { StepKind } from "./steps";

/** Each plan step's icon in the app UI (no emoji in buttons or tiles). */
export const STEP_ICONS: Record<StepKind, LucideIcon> = {
  gift: GiftIcon,
  message: MailIcon,
  call: PhoneIcon,
  cake: CakeIcon,
  kind_word: FeatherIcon,
  visit: HouseIcon,
  friends: UsersIcon,
  treat: SparklesIcon,
  other: StarIcon,
};

/** Decorative: the step's label is always next to it. */
export function StepIcon({ kind, className }: { kind: StepKind; className?: string }) {
  const Icon = STEP_ICONS[kind];
  return <Icon aria-hidden className={cn("size-5 shrink-0", className)} />;
}
