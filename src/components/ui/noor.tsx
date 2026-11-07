import * as React from "react";

import { cn } from "@/lib/utils";

export type NoorMood = "calm" | "smiling";

/**
 * Noor, the pink birthday candle (shape and colours from the approved screens).
 * Decorative by default; pass `label` when she carries meaning on her own.
 *
 * `mood`:
 * - "calm" (default): dot eyes, a small smile. Everyday UI.
 * - "smiling": happy arched eyes, an open smile and a glowing inner flame.
 *   Welcoming moments: the auth panels, onboarding, celebrations.
 *
 * `animated` turns on her gentle bob and flame flicker, the only motion
 * allowed to loop. Both stop under reduced motion. Use it once per view.
 */
function Noor({
  size = 52,
  mood = "calm",
  animated = false,
  label,
  className,
}: {
  /** Width in px. 40–58 in UI, 86–120 in hero moments. */
  size?: number;
  mood?: NoorMood;
  animated?: boolean;
  label?: string;
  className?: string;
}) {
  const flameClass = cn(
    "[transform-origin:50%_90%] [transform-box:fill-box]",
    animated && "animate-flicker",
  );

  return (
    <svg
      data-slot="noor"
      data-mood={mood}
      width={size}
      height={Math.round((size * 80) / 60)}
      viewBox="0 0 60 80"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 overflow-visible", animated && "animate-bob", className)}
    >
      <path
        d="M30 3 C37 12 39 18 35 24 C33 27 27 27 25 24 C21 18 23 12 30 3Z"
        className={cn(flameClass, "fill-noor-flame stroke-noor-flame-edge")}
        strokeWidth={1.2}
      />
      {mood === "smiling" && (
        <path
          data-part="inner-flame"
          d="M30 11 C33 15 33.5 19 31.5 22.5 C30.5 24 29.5 24 28.5 22.5 C26.5 19 27 15 30 11Z"
          className={cn(flameClass, "fill-noor-flame-inner")}
        />
      )}
      <rect x="29" y="25" width="2" height="6" rx="1" className="fill-noor-wick" />
      <rect x="13" y="30" width="34" height="46" rx="13" className="fill-noor-body" />
      <path
        d="M13 44 L47 36 L47 42 L13 50Z M13 60 L47 52 L47 58 L13 66Z"
        className="fill-noor-stripe"
      />
      <rect
        x="13"
        y="30"
        width="34"
        height="46"
        rx="13"
        fill="none"
        className="stroke-noor-outline"
        strokeWidth={2}
      />

      {mood === "smiling" ? (
        <>
          <path
            data-part="eyes"
            d="M22 47 Q24 43.5 26 47 M34 47 Q36 43.5 38 47"
            fill="none"
            className="stroke-noor-face"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <path data-part="mouth" d="M24 53 Q30 61 36 53Z" className="fill-noor-face" />
        </>
      ) : (
        <>
          <circle cx="24" cy="47" r="2.8" className="fill-noor-face" />
          <circle cx="36" cy="47" r="2.8" className="fill-noor-face" />
          <path
            d="M26 54 Q30 58 34 54"
            fill="none"
            className="stroke-noor-face"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      )}

      <ellipse cx="19.5" cy="53" rx="3" ry="2" className="fill-noor-blush" opacity={0.55} />
      <ellipse cx="40.5" cy="53" rx="3" ry="2" className="fill-noor-blush" opacity={0.55} />
    </svg>
  );
}

export { Noor };
