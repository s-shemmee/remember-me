import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Button (pill). Based on shadcn's Button, restyled to docs/design-system.md:
 * radius 999, weight 600, min 44px (54px for main CTAs), lifts 1px on hover,
 * scales to .97 when pressed. One accent button per view.
 *
 * Hover tints the button's own colour (`hover-tint`, globals.css) instead of
 * switching to a surface colour, so it never disappears into the card behind
 * it (e2e/ui-buttons.spec.ts checks every variant on every surface).
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap select-none",
    "transition-[transform,background-color,color] duration-200 ease-soft",
    "hover-tint hover:-translate-y-px active:scale-[.97] active:translate-y-0",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  ],
  {
    variants: {
      variant: {
        accent: "bg-accent text-on-accent",
        card2: "bg-card2 text-text",
        transparent: "bg-transparent text-text",
      },
      size: {
        default: "min-h-11 px-6 text-15",
        lg: "min-h-[54px] px-8 text-16",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "accent",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child (e.g. a Next.js <Link>) with button styles. */
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...(!asChild && { type: props.type ?? "button" })}
      {...props}
    />
  );
}

export { Button, buttonVariants, type ButtonProps };
