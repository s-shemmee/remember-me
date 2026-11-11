import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { NoorBubble } from "@/components/ui/noor-bubble";
import { ConnectionsScreen } from "@/features/connections/components/connections-screen";
import { loadConnections } from "@/features/connections/load";
import { AppMain } from "@/features/shell/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My profile · Remember Me" };

async function Connections() {
  const supabase = await createSupabaseServerClient();
  const data = await loadConnections(supabase);
  return <ConnectionsScreen {...data} />;
}

export default function ProfilePage() {
  return (
    <AppMain>
      <div className="flex flex-col gap-1">
        <h1 className="text-34 leading-tight font-extrabold tracking-[-0.03em]">My profile</h1>
        <p className="text-15 text-sub">How you show up for your people</p>
      </div>
      <Suspense fallback={<Card aria-busy="true" className="h-64" />}>
        <Connections />
      </Suspense>
      <div className="max-w-xl">
        <NoorBubble>
          Your card, about you and who sees what are coming soon. Connections are ready now 💛
        </NoorBubble>
      </div>
    </AppMain>
  );
}
