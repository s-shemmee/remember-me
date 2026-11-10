"use client";

import { Button } from "@/components/ui/button";
import { clearOnboardingDraft } from "@/features/onboarding/store";

import { logOut } from "../actions";

/** Log out, also clearing any onboarding draft left in this tab. */
export function LogOutButton() {
  return (
    <form action={logOut} onSubmit={() => clearOnboardingDraft()}>
      <Button type="submit" variant="card2">
        Log out
      </Button>
    </form>
  );
}
