import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { AccountCard } from "@/features/account/components/account-card";
import { DeleteAccountCard } from "@/features/account/components/data-card";
import { LogOutButton } from "@/features/account/components/log-out-button";
import { reauthModeFor } from "@/features/account/reauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account · Settings · Remember Me" };

/** Email and password, then the danger card, then Log out. */
async function Account() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user?.email) return null;
  const mode = reauthModeFor((user.identities ?? []).map((i) => i.provider));
  return (
    <>
      <AccountCard email={user.email} mode={mode} />
      <DeleteAccountCard email={user.email} mode={mode} />
    </>
  );
}

export default function AccountSettingsPage() {
  return (
    <>
      <Suspense fallback={<Card aria-busy="true" className="h-96" />}>
        <Account />
      </Suspense>
      <LogOutButton />
    </>
  );
}
