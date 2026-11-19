import Link from "next/link";

import { HEART_PATH, HEART_VIEWBOX } from "@/lib/logo-mark";
import { cn } from "@/lib/utils";

/**
 * "Remember me" wordmark: a heart in a rounded accent square, "Remember"
 * in Plus Jakarta 800 and "me" in Instrument Serif italic.
 * A link by default; pass `href={null}` for a plain wordmark (onboarding,
 * where there is nowhere to go back to yet).
 */
function Logo({
  href = "/",
  label = "Remember me, home",
  className,
}: {
  href?: string | null;
  /** Accessible name, e.g. "Remember me, back to home". */
  label?: string;
  className?: string;
}) {
  const classes = cn(
    "inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-chip text-19 font-extrabold tracking-[-0.02em] whitespace-nowrap",
    className,
  );
  const content = (
    <>
      <span aria-hidden className="grid size-8 place-items-center rounded-chip bg-accent">
        <svg viewBox={HEART_VIEWBOX} className="size-4 fill-on-accent">
          <path d={HEART_PATH} />
        </svg>
      </span>
      <span aria-hidden>
        Remember <em className="-ml-0.5 font-serif text-[23px] font-normal text-accent-text">me</em>
      </span>
    </>
  );

  if (href === null) {
    return (
      <span role="img" aria-label={label} className={classes}>
        {content}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={classes}>
      {content}
    </Link>
  );
}

export { Logo };
