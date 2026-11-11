import { Avatar } from "@/components/ui/avatar";
import { pastelClasses } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

import type { PersonView } from "../view";

/**
 * A person on the People grid (AppPeople.dc.html): avatar in their colour,
 * name and relation, and a pill in their colour with their next day.
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
        "transition-[transform,box-shadow] duration-200 ease-soft hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
        current === "page" && "ring-[2.5px] ring-accent",
        current === "implicit" && "xl:ring-[2.5px] xl:ring-accent",
      )}
    >
      <Avatar name={person.name} pastel={person.color} decorative className="size-[52px] text-16" />
      <span className="flex w-full min-w-0 flex-1 flex-col items-start gap-2 @[30rem]:gap-2.5">
        <span className="flex w-full min-w-0 flex-col gap-0.5">
          <span className="truncate text-17 font-bold">{person.name}</span>
          {(person.relationLabel || person.connected) && (
            <span className="truncate text-14 text-sub">
              {[person.relationLabel, person.connected ? "Connected" : null]
                .filter(Boolean)
                .join(" · ")}
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
            {person.next.label} · {person.next.when}
          </span>
        )}
      </span>
    </a>
  );
}
