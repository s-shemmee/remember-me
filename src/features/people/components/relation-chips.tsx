"use client";

import { ChoiceGroup, ChoiceItem } from "@/components/ui/choice-group";
import { cn } from "@/lib/utils";
import type { Pastel } from "@/styles/tokens";

import { type Relation, RELATION_COLORS, RELATIONS } from "../constants";

/** Relation chip look per colour: a dot in the ink; checked fills with the pastel. */
const relationChip: Record<Pastel, { chip: string; dot: string }> = {
  peach: {
    chip: "data-[state=checked]:bg-peach data-[state=checked]:text-peach-ink data-[state=checked]:ring-peach-ink",
    dot: "bg-peach-ink",
  },
  lilac: {
    chip: "data-[state=checked]:bg-lilac data-[state=checked]:text-lilac-ink data-[state=checked]:ring-lilac-ink",
    dot: "bg-lilac-ink",
  },
  mint: {
    chip: "data-[state=checked]:bg-mint data-[state=checked]:text-mint-ink data-[state=checked]:ring-mint-ink",
    dot: "bg-mint-ink",
  },
  sky: {
    chip: "data-[state=checked]:bg-sky data-[state=checked]:text-sky-ink data-[state=checked]:ring-sky-ink",
    dot: "bg-sky-ink",
  },
  rose: {
    chip: "data-[state=checked]:bg-rose data-[state=checked]:text-rose-ink data-[state=checked]:ring-rose-ink",
    dot: "bg-rose-ink",
  },
  butter: {
    chip: "data-[state=checked]:bg-butter data-[state=checked]:text-butter-ink data-[state=checked]:ring-butter-ink",
    dot: "bg-butter-ink",
  },
};

/** Fill classes for a heart (or any SVG) in a person's ink. */
export const heartInk: Record<Pastel, string> = {
  peach: "fill-peach-ink",
  lilac: "fill-lilac-ink",
  mint: "fill-mint-ink",
  sky: "fill-sky-ink",
  rose: "fill-rose-ink",
  butter: "fill-butter-ink",
};

/**
 * The five relation chips (docs/design-system.md, "Relation chip"): a radio
 * group, so arrows move and select. Each has a dot in its colour and fills
 * with that colour when picked.
 */
export function RelationChips({
  labelId,
  value,
  onChange,
}: {
  /** Id of the visible label for the group. */
  labelId: string;
  value: Relation;
  onChange: (relation: Relation) => void;
}) {
  return (
    <ChoiceGroup
      aria-labelledby={labelId}
      value={value}
      onValueChange={(relation) => onChange(relation as Relation)}
    >
      {RELATIONS.map((r) => {
        const look = relationChip[RELATION_COLORS[r]];
        return (
          <ChoiceItem
            key={r}
            value={r}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-pill bg-card2 px-4 text-15 font-semibold text-text data-[state=checked]:ring-2",
              look.chip,
            )}
          >
            <span aria-hidden className={cn("size-2.5 rounded-full", look.dot)} />
            {r}
          </ChoiceItem>
        );
      })}
    </ChoiceGroup>
  );
}
