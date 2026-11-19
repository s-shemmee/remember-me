"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tabs as the segmented control from the Wishlists and Onboarding screens:
 * a card2 pill track, 44px bold triggers, the active one a card pill with
 * the card shadow. Arrow keys move between tabs (Radix).
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      // min-w-0 lets it shrink inside grid/flex parents, so a long tab list scrolls instead of overflowing.
      className={cn("flex min-w-0 flex-col gap-6", className)}
      {...props}
    />
  );
}

/**
 * The segmented look, shared with choices that aren't tabs (e.g. a theme
 * picker made of aria-pressed buttons). Tabs must control tab panels; for a
 * plain choice use these classes on a role="group" of buttons instead.
 */
const segmentedTrackClass =
  "inline-flex w-fit max-w-full gap-1 self-start overflow-x-auto rounded-pill bg-card2 p-1";
const segmentedOptionClass = cn(
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-pill px-[18px] text-15 font-bold whitespace-nowrap text-text",
  "transition-[background-color,box-shadow] duration-200 ease-soft",
  "hover-tint data-active:bg-card data-active:shadow-card aria-pressed:bg-card aria-pressed:shadow-card",
  "disabled:pointer-events-none disabled:opacity-50",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
);

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(segmentedTrackClass, className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(segmentedOptionClass, className)}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("rounded-card", className)}
      {...props}
    />
  );
}

export { segmentedOptionClass, segmentedTrackClass, Tabs, TabsContent, TabsList, TabsTrigger };
