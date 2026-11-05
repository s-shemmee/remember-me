import * as React from "react";

import { cn } from "@/lib/utils";

import { Noor } from "./noor";

/**
 * Noor's speech bubble: card background, radius 22 22 22 6, sitting next to
 * Noor. `live` makes changing messages announce politely (aria-live), for
 * bubbles whose text updates while the page is open.
 * Copy: first person, warm, short, one emoji max.
 */
function NoorBubble({
  children,
  live = false,
  showNoor = true,
  animated = false,
  className,
}: {
  children: React.ReactNode;
  live?: boolean;
  showNoor?: boolean;
  animated?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="noor-bubble" className={cn("flex items-end gap-3", className)}>
      {showNoor && <Noor size={44} animated={animated} />}
      <p
        aria-live={live ? "polite" : undefined}
        className="max-w-sm rounded-[22px_22px_22px_6px] bg-card px-4 py-3 text-15 text-text shadow-card"
      >
        {children}
      </p>
    </div>
  );
}

export { NoorBubble };
