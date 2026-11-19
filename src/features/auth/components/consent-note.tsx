import Link from "next/link";

const LINK = "font-semibold text-text underline underline-offset-2";

/**
 * Consent, right under the buttons that create an account: "Create my
 * account" and "Continue with Google" on sign-up, and "Continue with Google"
 * on log-in (it creates an account for someone new). Plain text with links,
 * never a pre-ticked box.
 */
export function ConsentNote({ newWithGoogle = false }: { newWithGoogle?: boolean }) {
  return (
    <p className="-mt-2 text-center text-13 leading-normal text-balance text-sub">
      {newWithGoogle
        ? "New here? Continuing with Google creates an account, and you agree to our "
        : "By creating an account, you agree to our "}
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
