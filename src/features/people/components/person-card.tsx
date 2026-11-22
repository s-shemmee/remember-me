import { Avatar } from "@/components/ui/avatar";
import { pastelClasses } from "@/components/ui/chip";
import { OccasionEmoji } from "@/features/occasions/occasion-emoji";
import { cn } from "@/lib/utils";

import type { PersonView } from "../view";

/**
 * A person on the People grid (AppPeople.dc.html): avatar in their colour
 * with a "Connected" badge on the right when you're connected, name and
 * relation, and a pill in their colour with their next day ("🎂 Birthday · in 2 days").
 * A link to their profile (?person=id), marked aria-current when shown.
 */
export function PersonCard({
  person,
  current,
  onSelect,
}: {
  person: PersonView;
  /** "page" when their profile is open; "implicit" when it's only the desktop default. */
  current: "page" | "implicit" | false;
  onSelect: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <a
      href={`?person=${person.id}`}
      onClick={onSelect}
      aria-current={current === "page" ? "true" : undefined}
      data-person-id={person.id}
      className={cn(
        // A compact row in a narrow list (phones), the design's tall card from 30rem.
        "flex h-full min-w-0 items-center gap-3.5 rounded-card bg-card p-4 shadow-card @[30rem]:flex-col @[30rem]:items-start @[30rem]:gap-2.5 @[30rem]:p-[18px]",
        // Light: lift and a stronger shadow (a tint would turn it card2-grey on the
        // page background); dark keeps its tint.
        "card-lift dark:hover-tint",
        current === "page" && "ring-2 ring-accent",
        current === "implicit" && "xl:ring-2 xl:ring-accent",
      )}
    >
      <span className="flex shrink-0 items-start justify-between gap-2 @[30rem]:w-full">
        <Avatar
          name={person.name}
          pastel={person.color}
          decorative
          className="size-[52px] text-16"
        />
        {person.connected && (
          <span
            aria-hidden="true"
            className="hidden rounded-pill bg-card2 px-2.5 py-1 text-12 font-semibold @[30rem]:inline"
          >
            Connected
          </span>
        )}
      </span>
      <span className="flex w-full min-w-0 flex-1 flex-col items-start gap-2 @[30rem]:gap-2.5">
        <span className="flex w-full min-w-0 flex-col gap-0.5">
          <span className="truncate text-17 font-bold">{person.name}</span>
          {(person.relationLabel || person.connected) && (
            <span className="truncate text-14 text-sub">
              {person.relationLabel}
              {/* Narrow rows have no badge: say it here (the badge is aria-hidden). */}
              {person.connected && (
                <>
                  <span className="@[30rem]:hidden">
                    {person.relationLabel ? " · " : ""}Connected
                  </span>
                  <span className="sr-only hidden @[30rem]:inline">
                    {person.relationLabel ? ", " : ""}Connected
                  </span>
                </>
              )}
            </span>
          )}
        </span>
        {person.next && (
          <span
            className={cn(
              "max-w-full truncate rounded-pill px-3 py-1.5 text-13 font-bold",
              person.next.gentle ? "bg-card2 text-text" : pastelClasses[person.color],
            )}
          >
            <OccasionEmoji kind={person.next.kind} gentle={person.next.gentle} className="mr-1.5" />
            {person.next.label} · {person.next.when}
          </span>
        )}
      </span>
    </a>
  );
}
