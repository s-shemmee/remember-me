import { cn } from "@/lib/utils";
import type { Pastel } from "@/styles/tokens";

import { planDots, planLabel, type PlanView } from "../steps";

const inkBg: Record<Pastel, string> = {
  peach: "bg-peach-ink",
  lilac: "bg-lilac-ink",
  mint: "bg-mint-ink",
  sky: "bg-sky-ink",
  rose: "bg-rose-ink",
  butter: "bg-butter-ink",
};

/**
 * "Coming up" plan dots (AppHome): one per step in the plan's order, filled
 * in the person's ink when done; past five, "+N". The label says it all.
 */
export function PlanDots({ plan, color }: { plan: PlanView; color: Pastel }) {
  const { dots, more } = planDots(plan);
  if (!dots.length) return null;
  return (
    <span role="img" aria-label={planLabel(plan)} className="flex shrink-0 items-center gap-1">
      {dots.map((on, i) => (
        <span key={i} className={cn("size-2 rounded-full", on ? inkBg[color] : "bg-line")} />
      ))}
      {more > 0 && <span className="text-12 font-semibold text-sub">+{more}</span>}
    </span>
  );
}
