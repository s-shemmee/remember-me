import type { Metadata } from "next";
import { Suspense } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { NoorBubble } from "@/components/ui/noor-bubble";
import { TruncatedName } from "@/components/ui/truncated-name";
import { LogOutButton } from "@/features/auth/components/log-out-button";
import { MONTHS } from "@/features/onboarding/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type Pastel, pastels } from "@/styles/tokens";

export const metadata: Metadata = { title: "Home · Remember Me" };

// Placeholder until the real Home (M2). The (app) layout guarantees a
// finished onboarding; RLS means the queries only ever return your own rows.

const asPastel = (c: string | null | undefined): Pastel =>
  pastels.includes(c as Pastel) ? (c as Pastel) : "lilac";

async function Greeting() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("first_name").maybeSingle();
  const name = data?.first_name;
  return (
    <h1 className="text-34 leading-tight font-extrabold tracking-heading sm:text-44">
      You&apos;re <em className="font-serif font-normal text-accent-text">in</em>
      {name ? (
        <>
          , <TruncatedName>{name}</TruncatedName>
        </>
      ) : null}
    </h1>
  );
}

async function YourPeople() {
  const supabase = await createSupabaseServerClient();
  const { data: people } = await supabase
    .from("people")
    .select("id, name, relation, color, occasions(kind, day, month)")
    .is("archived_at", null)
    .order("created_at");

  if (!people?.length) {
    return (
      <Card>
        <NoorBubble>Add your people anytime. I&apos;ll help you remember their days 💛</NoorBubble>
      </Card>
    );
  }

  return (
    <Card className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <h2 className="text-19 font-extrabold tracking-heading">Your people</h2>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {people.map((p) => {
          const birthday = p.occasions.find((o) => o.kind === "birthday");
          return (
            <li key={p.id} className="flex min-w-0 items-center gap-3">
              <Avatar name={p.name} pastel={asPastel(p.color)} decorative className="shrink-0" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-17 font-bold">{p.name}</span>
                <span className="truncate text-14 text-sub">
                  {p.relation}
                  {birthday ? ` · ${birthday.day} ${MONTHS[birthday.month - 1]}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col gap-10 px-4 py-6 sm:px-10">
      <header className="flex items-center justify-between gap-3">
        <Logo href="/home" />
        <LogOutButton />
      </header>
      <main id="main" className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <Suspense
          fallback={
            <h1 className="text-34 leading-tight font-extrabold tracking-heading sm:text-44">
              You&apos;re <em className="font-serif font-normal text-accent-text">in</em>
            </h1>
          }
        >
          <Greeting />
        </Suspense>
        <Suspense fallback={<Card aria-busy="true" className="h-28" />}>
          <YourPeople />
        </Suspense>
      </main>
    </div>
  );
}
