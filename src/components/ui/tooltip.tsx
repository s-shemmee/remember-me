"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A small label for an icon-only control (Radix Tooltip). Shows on hover and
 * on keyboard focus, hides on Escape. The trigger still needs its own
 * aria-label: a tooltip is a visual hint, not the accessible name.
 */
function Tooltip({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children: React.ReactElement;
  side?: React.ComponentProps<typeof TooltipPrimitive.Content>["side"];
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className={cn(
              "z-50 rounded-[10px] bg-text px-2.5 py-1.5 text-13 font-semibold text-bg shadow-card",
              "data-[state=closed]:animate-fade-out data-[state=delayed-open]:animate-fade-in",
            )}
          >
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export { Tooltip };
