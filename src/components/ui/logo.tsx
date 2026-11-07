import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * "Remember me" wordmark: a heart in a rounded accent square, "Remember"
 * in Plus Jakarta 800 and "me" in Instrument Serif italic.
 */
function Logo({
  href = "/",
  label = "Remember me, home",
  className,
}: {
  href?: string;
  /** Accessible name of the link, e.g. "Remember me, back to home". */
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-chip text-19 font-extrabold tracking-[-0.02em] whitespace-nowrap",
        className,
      )}
    >
      <span aria-hidden className="grid size-8 place-items-center rounded-chip bg-accent">
        <svg viewBox="0 0 24 24" className="size-4 fill-on-accent">
          <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.7 3.2 5 6.8 5c2 0 3.5 1.1 5.2 3 1.7-1.9 3.2-3 5.2-3 3.6 0 5.6 3.7 4.3 6.8C19.5 16.4 12 21 12 21z" />
        </svg>
      </span>
      <span aria-hidden>
        Remember <em className="-ml-0.5 font-serif text-[23px] font-normal text-accent-text">me</em>
      </span>
    </Link>
  );
}

export { Logo };
