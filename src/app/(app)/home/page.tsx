import type { Metadata } from "next";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { NoorBubble } from "@/components/ui/noor-bubble";
import { logOut } from "@/features/auth/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home · Remember Me" };

// Placeholder until onboarding (M1 part 2) and Home (M2). The proxy only lets
// signed-in people here; RLS means the query can only return their own profile.

async function Greeting() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("first_name").maybeSingle();
  const name = data?.first_name;
  return (
    <h1 className="text-34 leading-tight font-extrabold tracking-heading sm:text-44">
      You&apos;re <em className="font-serif font-normal text-accent-text">in</em>
      {name ? `, ${name}` : ""}
    </h1>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col gap-10 px-4 py-6 sm:px-10">
      <header className="flex items-center justify-between gap-3">
        <Logo href="/home" />
        <form action={logOut}>
          <Button type="submit" variant="card2">
            Log out
          </Button>
        </form>
      </header>
      <main id="main" className="grid gap-6">
        <Suspense
          fallback={
            <h1 className="text-34 leading-tight font-extrabold tracking-heading sm:text-44">
              You&apos;re <em className="font-serif font-normal text-accent-text">in</em>
            </h1>
          }
        >
          <Greeting />
        </Suspense>
        <Card>
          <NoorBubble>
            Your space is ready. Next, we&apos;ll add your birthday and your first person together
            🤍
          </NoorBubble>
        </Card>
      </main>
    </div>
  );
}
