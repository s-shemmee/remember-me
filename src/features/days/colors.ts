import type { Pastel } from "@/styles/tokens";

/** A person's ink as a fill (dots on calendars). */
export const inkBg: Record<Pastel, string> = {
  peach: "bg-peach-ink",
  lilac: "bg-lilac-ink",
  mint: "bg-mint-ink",
  sky: "bg-sky-ink",
  rose: "bg-rose-ink",
  butter: "bg-butter-ink",
};

/** A person's ink as text (countdowns on a card). */
export const inkText: Record<Pastel, string> = {
  peach: "text-peach-ink",
  lilac: "text-lilac-ink",
  mint: "text-mint-ink",
  sky: "text-sky-ink",
  rose: "text-rose-ink",
  butter: "text-butter-ink",
};
