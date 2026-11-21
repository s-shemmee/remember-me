"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Popover (shadcn/ui on Radix), in our look: card panel, radius 20, the
 * popover shadow. Escape and an outside click close it, and focus goes back
 * to the trigger.
 */
function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "start",
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-[min(380px,calc(100vw-32px))] rounded-[20px] bg-card p-3 text-text shadow-[0_12px_40px_rgba(20,20,30,.18)] outline-none dark:shadow-[0_0_0_1px_var(--line),0_12px_40px_rgba(0,0,0,.5)]",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
