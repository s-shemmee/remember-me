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
 *
 * Secondary buttons never match the surface they sit on: `card2` on card
 * surfaces, `card` on card2 and pastel ones. Disabled keeps its colour at
 * 45% (an accent button never turns grey) with a not-allowed cursor.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap select-none",
    "transition-[transform,background-color,color] duration-200 ease-soft",
    "not-disabled:not-aria-disabled:hover-tint not-disabled:not-aria-disabled:hover:-translate-y-px not-disabled:not-aria-disabled:active:scale-[.97] active:translate-y-0",
    "disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  ],
  {
    variants: {
      variant: {
        accent: "bg-accent text-on-accent",
        card2: "bg-card2 text-text",
        // Hover is a light accent wash: a grey one would land between bg and
        // card2 and vanish into one of them (e2e/ui-buttons.spec.ts).
        card: "bg-card text-text [--hover-tint-color:var(--accent)] [--hover-tint:10%]",
        // A secondary button right on the page background (header icon
        // buttons): white with the accent wash in light (card2 there is too
        // close to the background); card2 with the usual tint in dark.
        page: "bg-card text-text [--hover-tint-color:var(--accent)] [--hover-tint:10%] dark:bg-card2 dark:[--hover-tint-color:var(--text)] dark:[--hover-tint:9%]",
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
