/**
 * Every message the auth flows show. Responses never reveal whether an
 * address has an account: the same wording is used for new and registered
 * addresses, and for incorrect passwords and unknown email addresses.
 */
export const AUTH_MESSAGES = {
  // Everywhere
  tooMany: "Too many tries. Please wait a minute.",
  generic: "Something went wrong on our side. Please try again.",

  // Log in
  badLogin: "Email or password is incorrect",
  googleHint: "Signed up with Google? Use Continue with Google",
  notConfirmed: "Please confirm your email first",

  // Check your email / Resend
  accountHint: "Already have an account? We've emailed you a link to log in instead.",
  resent: "Sent again. It can take a minute to arrive.",
  resendWait: "Please wait a minute before sending again.",
  resendNeedsEmail: "Please sign up again so we know where to send it.",

  // Forgot / reset password
  resetSent: "If there's an account for that email, we've sent a link to reset your password.",
  linkExpired: "This link has expired. Ask for a new one below.",
  samePassword: "That's your current password. Choose a new one.",
  weakPassword: "That password is too easy to guess. Try a longer one.",
} as const;

/** Messages for /log-in?error= after a failed email link or Google sign-in. */
export const LINK_ERRORS: Record<string, string> = {
  link: "That link has expired or was already used. Log in, or ask for a new one.",
  google: "Google sign-in didn't finish. Please try again.",
};

/** How long the Resend buttons wait between sends. */
export const RESEND_COOLDOWN_SECONDS = 60;
