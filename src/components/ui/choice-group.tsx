"use client";

import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Pick one of several options, shown as chips, swatches or tiles: a real
 * radio group (Radix), so arrow keys move between options, Tab enters and
 * leaves the group, and screen readers hear "radio, 2 of 6, checked".
 * Style each item with `className`; the checked one gets data-state="checked".
 */
function ChoiceGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="choice-group"
      className={cn("flex flex-wrap gap-2", className)}
      {...props}
    />
  );
}

function ChoiceItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="choice-item"
      className={cn(
        "hover-tint cursor-pointer transition-[background-color,color,box-shadow,transform] duration-200 ease-soft",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { ChoiceGroup, ChoiceItem };
