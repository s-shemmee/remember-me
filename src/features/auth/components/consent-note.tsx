import Link from "next/link";

const LINK = "font-semibold text-text underline underline-offset-2";

/**
 * The one consent line on sign-up and log-in, at the very bottom (under the
 * "Log in" / "Create a free account" link). "By continuing": on either page,
 * Google can create an account for someone new. Plain text with links, never
 * a pre-ticked box.
 */
export function ConsentNote() {
  return (
    <p className="text-center text-13 leading-normal text-balance text-sub">
      By continuing, you agree to our{" "}
      <Link href="/terms" className={LINK}>
        Terms
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className={LINK}>
        Privacy Policy
      </Link>
      .
    </p>
  );
}
