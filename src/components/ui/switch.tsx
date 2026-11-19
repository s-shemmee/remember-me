"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Switch, from the Settings and Celebrate screens: 48×28, 22px knob,
 * accent when on. Off adds a 1.5px `sub` outline so the control meets 3:1
 * against the page (the line-coloured track alone is about 1.3:1).
 * The touch area is enlarged to 44px tall without changing the look; hover
 * tints the track (`hover-tint`), like every other control.
 * Always give it a label (aria-label or a <label htmlFor>).
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-pill hover-tint",
        "transition-colors duration-200 ease-soft",
        "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-['']",
        "data-checked:bg-accent",
        "data-unchecked:bg-line data-unchecked:shadow-[inset_0_0_0_1.5px_var(--sub)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-[22px] rounded-pill bg-card shadow-[0_1px_3px_rgba(0,0,0,.25)]",
          "transition-transform duration-[250ms] ease-soft",
          "data-checked:translate-x-[23px] data-unchecked:translate-x-[3px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
