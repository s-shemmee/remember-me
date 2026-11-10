import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A name inside a line of text (a heading, a greeting) that never breaks the
 * layout: one line, cut with an ellipsis at the width available. The full
 * name stays in the accessible text. For a name on its own line, `truncate`
 * on the element is enough.
 */
function TruncatedName({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="truncated-name"
      className={cn("inline-block max-w-full truncate align-bottom", className)}
      {...props}
    />
  );
}

export { TruncatedName };
