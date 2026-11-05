import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Noor, the pink birthday candle (shape and colours from the approved hero).
 * Decorative by default; pass `label` when she carries meaning on her own.
 * `animated` turns on her gentle bob and flame flicker, the only motion
 * allowed to loop. Both stop under reduced motion. Use it once per view.
 */
function Noor({
  size = 52,
  animated = false,
  label,
  className,
}: {
  /** Width in px. 40–58 in UI, 86–120 in hero moments. */
  size?: number;
  animated?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      data-slot="noor"
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
        className={cn(
          "[transform-origin:50%_90%] fill-noor-flame stroke-noor-flame-edge [transform-box:fill-box]",
          animated && "animate-flicker",
        )}
        strokeWidth={1.2}
      />
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
      <circle cx="24" cy="47" r="2.8" className="fill-noor-face" />
      <circle cx="36" cy="47" r="2.8" className="fill-noor-face" />
      <path
        d="M26 54 Q30 58 34 54"
        fill="none"
        className="stroke-noor-face"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <ellipse cx="19.5" cy="53" rx="3" ry="2" className="fill-noor-blush" opacity={0.55} />
      <ellipse cx="40.5" cy="53" rx="3" ry="2" className="fill-noor-blush" opacity={0.55} />
    </svg>
  );
}

export { Noor };
