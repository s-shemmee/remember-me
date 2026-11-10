import Link from "next/link";

import { Button } from "@/components/ui/button";
import { NoorBubble } from "@/components/ui/noor-bubble";

import { AppMain } from "./app-shell";

/**
 * A gentle placeholder for sections that aren't built yet, so no link in the
 * shell leads to a 404. Remove each one when its milestone ships.
 */
export function ComingSoon({ title, line }: { title: string; line: string }) {
  return (
    <AppMain>
      <h1 className="text-34 leading-tight font-extrabold tracking-heading">{title}</h1>
      <div className="flex max-w-xl flex-col gap-6 rounded-card-lg bg-card p-6 shadow-card sm:p-8">
        <NoorBubble className="[&_p]:bg-card2 [&_p]:shadow-none">{line}</NoorBubble>
        <Button asChild variant="card2" className="w-fit">
          <Link href="/people">Go to your people</Link>
        </Button>
      </div>
    </AppMain>
  );
}
