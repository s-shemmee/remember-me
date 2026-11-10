export const ONBOARDING_PATH = "/onboarding";

/**
 * Where a signed-in person should be, given whether they finished onboarding.
 * Used by the (app) layout gate, the /onboarding page and the log-in action.
 * Returns a path to redirect to, or null to stay.
 */
export function onboardingRedirect(pathname: string, onboarded: boolean): string | null {
  const onOnboarding = pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`);
  if (!onboarded && !onOnboarding) return ONBOARDING_PATH;
  if (onboarded && onOnboarding) return "/home";
  return null;
}
