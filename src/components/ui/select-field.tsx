import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

import { fieldInputClass } from "./field";

/**
 * A native <select> with the Field look (52px, 1.5px line border, accent
 * focus ring). Native on purpose: the best keyboard, screen-reader and
 * mobile picker support for short lists like day and month.
 * Give it a label (visible <label>, or aria-label inside a labelled fieldset).
 */
function SelectField({
  className,
  invalid,
  children,
  ...props
}: React.ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <div data-slot="select-field" className={cn("relative", className)}>
      <select
        aria-invalid={invalid || undefined}
        className={cn(fieldInputClass, "cursor-pointer appearance-none pr-11")}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-sub"
      />
    </div>
  );
}

export { SelectField };
