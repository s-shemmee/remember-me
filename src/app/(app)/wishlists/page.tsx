import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { AppMain } from "@/features/shell/app-shell";
import { WishlistsScreen } from "@/features/wishes/components/wishlists-screen";
import { loadWishlists } from "@/features/wishes/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Wishlists · Remember Me" };

async function Wishlists() {
  const supabase = await createSupabaseServerClient();
  const { userId, lists } = await loadWishlists(supabase);
  if (!userId) return null;
  return <WishlistsScreen lists={lists} userId={userId} />;
}

export default function WishlistsPage() {
  return (
    <AppMain>
      <Suspense
        fallback={
          <>
            <h1 className="text-34 leading-tight font-extrabold tracking-[-0.03em]">Wishlists</h1>
            <Card aria-busy="true" className="h-64" />
          </>
        }
      >
        <Wishlists />
      </Suspense>
    </AppMain>
  );
}
