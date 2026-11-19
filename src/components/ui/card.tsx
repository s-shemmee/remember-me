import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Card: card background, radius 24, card shadow (a 1px ring in dark mode).
 * `interactive` lifts it 2px on hover; use it only when the whole card is a
 * link or button (put the <a>/<button> inside, or render as one via `as`).
 */
type CardProps<T extends React.ElementType = "div"> = {
  as?: T;
  interactive?: boolean;
} & Omit<React.ComponentPropsWithoutRef<T>, "as">;

function Card<T extends React.ElementType = "div">({
  as,
  interactive = false,
  className,
  ...props
}: CardProps<T>) {
  const Comp = as ?? "div";
  return (
    <Comp
      data-slot="card"
      className={cn(
        "rounded-card bg-card p-5 text-text shadow-card sm:p-6",
        interactive &&
          "hover-tint transition-transform duration-200 ease-soft focus-within:-translate-y-0.5 hover:-translate-y-0.5",
        className,
      )}
      {...props}
    />
  );
}

export { Card, type CardProps };
