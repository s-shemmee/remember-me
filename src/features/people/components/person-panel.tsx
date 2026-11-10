"use client";

import { ArrowLeftIcon } from "lucide-react";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { pastelClasses } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import type { Pastel } from "@/styles/tokens";

import type { PersonView } from "../view";

const inkText: Record<Pastel, string> = {
  peach: "text-peach-ink",
  lilac: "text-lilac-ink",
  mint: "text-mint-ink",
  sky: "text-sky-ink",
  rose: "text-rose-ink",
  butter: "text-butter-ink",
};

function SectionLabel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-12 font-bold tracking-[.05em] text-sub uppercase">
      {children}
    </h3>
  );
}

/**
 * A person's profile (AppPeople.dc.html, right panel): their days with
 * countdowns, the little things they love, and their wishlist (connections
 * come in M3). From 1280px it sits next to the grid; below, it replaces the
 * grid and "All people" goes back.
 */
export function PersonPanel({
  person,
  onBack,
  onEdit,
  headingRef,
  className,
}: {
  person: PersonView;
  onBack: () => void;
  onEdit: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
  className?: string;
}) {
  const headingId = `person-${person.id}-name`;
  const ink = inkText[person.color];

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col gap-[18px] rounded-[28px] bg-card p-6 shadow-card",
        className,
      )}
    >
      <Button
        variant="transparent"
        onClick={onBack}
        className="-mt-2 -ml-3 self-start px-3 text-sub hover:text-text xl:hidden"
      >
        <ArrowLeftIcon aria-hidden /> All people
      </Button>

      <div className="flex min-w-0 items-center gap-3.5">
        <Avatar
          name={person.name}
          pastel={person.color}
          decorative
          className="size-[68px] text-22"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="truncate text-24 font-extrabold tracking-[-0.02em] outline-none"
          >
            {person.name}
          </h2>
          {person.relationLabel && (
            <span className="truncate text-14 text-sub">{person.relationLabel}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel id={`${headingId}-days`}>Days to remember</SectionLabel>
        <ul aria-labelledby={`${headingId}-days`} className="flex flex-col gap-2">
          {person.days.map((d) => (
            <li
              key={d.id}
              className="flex min-w-0 items-center gap-2.5 rounded-[16px] bg-card2 px-3.5 py-3"
            >
              <span aria-hidden className="text-[20px]">
                {d.emoji}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-15 font-bold [overflow-wrap:anywhere]">{d.title}</span>
                <span className="text-13 text-sub">{d.date}</span>
              </span>
              <span className={cn("shrink-0 text-13 font-bold", ink)}>{d.when}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel id={`${headingId}-things`}>Little things</SectionLabel>
        {person.littleThings.length ? (
          <ul aria-labelledby={`${headingId}-things`} className="flex flex-wrap gap-1.5">
            {person.littleThings.map((t, i) => (
              <li
                key={`${i}-${t}`}
                className={cn(
                  "max-w-full rounded-pill px-3 py-[7px] text-13 font-semibold [overflow-wrap:anywhere]",
                  pastelClasses[person.color],
                )}
              >
                {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-14 text-sub">
            Nothing yet. Add what they love, so gift ideas come easy.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel id={`${headingId}-wishlist`}>Their wishlist</SectionLabel>
        <p className="text-14 text-sub">Not connected yet, so no shared wishlist.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="card2" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </section>
  );
}
