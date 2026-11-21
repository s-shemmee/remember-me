import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { loadFriends } from "@/features/reservations/load";
import { AppMain } from "@/features/shell/app-shell";
import { PageHeaderFallback } from "@/features/shell/page-header";
import { WishlistsScreen } from "@/features/wishes/components/wishlists-screen";
import { loadWishlists } from "@/features/wishes/load";
import { notificationsInboxEnabled } from "@/lib/flags";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Wishlists · Remember Me" };

async function Wishlists() {
  const supabase = await createSupabaseServerClient();
  const [{ userId, lists }, { friends, notices }] = await Promise.all([
    loadWishlists(supabase),
    loadFriends(supabase),
  ]);
  if (!userId) return null;
  return (
    <WishlistsScreen
      lists={lists}
      userId={userId}
      friends={friends}
      notices={notices}
      bell={notificationsInboxEnabled()}
    />
  );
}

export default function WishlistsPage() {
  return (
    <AppMain>
      <Suspense
        fallback={
          <>
            <PageHeaderFallback title="Wishlists" />
            <Card aria-busy="true" className="h-64" />
          </>
        }
      >
        <Wishlists />
      </Suspense>
    </AppMain>
  );
}
