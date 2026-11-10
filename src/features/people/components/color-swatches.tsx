"use client";

import { ChoiceGroup, ChoiceItem } from "@/components/ui/choice-group";
import { pastelClasses } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import { type Pastel, pastels } from "@/styles/tokens";

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The six pastels as round 44px swatches: a radio group named by a visible
 * label. The picked one gets an accent ring, offset from the surface it
 * sits on (`surface`), so it reads on the page and in a dialog.
 */
export function ColorSwatches({
  labelId,
  value,
  onChange,
  surface = "bg",
}: {
  labelId: string;
  value: Pastel;
  onChange: (color: Pastel) => void;
  surface?: "bg" | "card";
}) {
  return (
    <ChoiceGroup
      aria-labelledby={labelId}
      value={value}
      onValueChange={(color) => onChange(color as Pastel)}
      className="gap-3"
    >
      {pastels.map((p) => (
        <ChoiceItem
          key={p}
          value={p}
          aria-label={capitalise(p)}
          className={cn(
            "size-11 rounded-pill ring-1 ring-line ring-inset",
            "data-[state=checked]:ring-3 data-[state=checked]:ring-accent data-[state=checked]:ring-offset-2",
            surface === "card"
              ? "data-[state=checked]:ring-offset-card"
              : "data-[state=checked]:ring-offset-bg",
            pastelClasses[p],
          )}
        />
      ))}
    </ChoiceGroup>
  );
}
