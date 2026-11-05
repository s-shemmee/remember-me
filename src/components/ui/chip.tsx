import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import type { Pastel } from "@/styles/tokens";
import { cn } from "@/lib/utils";

const pastelClasses: Record<Pastel, string> = {
  peach: "bg-peach text-peach-ink",
  lilac: "bg-lilac text-lilac-ink",
  mint: "bg-mint text-mint-ink",
  sky: "bg-sky text-sky-ink",
  rose: "bg-rose text-rose-ink",
  butter: "bg-butter text-butter-ink",
};

const chipVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-pill font-semibold whitespace-nowrap",
  {
    variants: {
      size: {
        sm: "min-h-7 px-3 text-13",
        md: "min-h-9 px-4 text-15",
        lg: "min-h-11 px-4 text-15",
      },
    },
    defaultVariants: { size: "md" },
  },
);

type ChipBaseProps = VariantProps<typeof chipVariants> & {
  /** A person's pastel: their fill with their ink (countdown pills, tags). */
  pastel?: Pastel;
};

/**
 * A static chip: labels, tags and countdown pills ("in 2 days").
 * For a person's countdown, pass their pastel.
 */
function Chip({ className, size, pastel, ...props }: React.ComponentProps<"span"> & ChipBaseProps) {
  return (
    <span
      data-slot="chip"
      className={cn(
        chipVariants({ size }),
        pastel ? pastelClasses[pastel] : "bg-card2 text-text",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A filter chip: a real toggle button, 44px tall. Selected = text fill with
 * bg-coloured text, announced with aria-pressed.
 */
function FilterChip({
  className,
  selected = false,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      data-slot="filter-chip"
      aria-pressed={selected}
      className={cn(
        chipVariants({ size: "lg" }),
        "cursor-pointer transition-colors duration-200 ease-soft",
        selected ? "bg-text text-bg" : "bg-card2 text-text hover:bg-line",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Chip, chipVariants, FilterChip, pastelClasses };
