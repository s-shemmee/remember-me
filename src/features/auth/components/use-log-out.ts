"use client";

import { useTransition } from "react";

import { logOut } from "@/features/auth/actions";
import { unsubscribeThisDevice } from "@/features/notifications/browser";
import { clearOnboardingDraft } from "@/features/onboarding/store";
import { forgetThemeUser } from "@/lib/theme";

/**
 * Log out from anywhere (the account menu, Settings → Account): clears this
 * device's onboarding draft and theme owner, and drops this device's push
 * subscription before signing out, so the next person on a shared device
 * never gets your reminders.
 */
export function useLogOut(): { pending: boolean; logOutNow: () => void } {
  const [pending, startTransition] = useTransition();
  const logOutNow = () => {
    clearOnboardingDraft();
    // The next person to log in here starts with their own theme.
    forgetThemeUser();
    startTransition(async () => {
      const endpoint = await unsubscribeThisDevice();
      await logOut(endpoint);
    });
  };
  return { pending, logOutNow };
}
