"use client";

import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { pastelClasses } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import { OccasionEmoji } from "@/features/occasions/occasion-emoji";
import { cn } from "@/lib/utils";

import { occasionTitle, typeFor } from "@/features/occasions/types";
import { PlanDots } from "@/features/plans/components/plan-dots";
import { PlanSheet } from "@/features/plans/components/plan-sheet";
import { usePlans } from "@/features/plans/components/plan-state";
import { pastPlans, planKey, type PlanTarget, progress, styleFor } from "@/features/plans/steps";

import { inkText } from "@/features/days/colors";

import { setInMemory } from "../actions";
import type { FriendWish } from "@/features/reservations/logic";
import { formatPrice } from "@/features/wishes/schema";

import type { DayView, PersonView } from "../view";

function SectionLabel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-12 font-bold tracking-[.05em] text-sub uppercase">
      {children}
    </h3>
  );
}

/**
 * A person's profile (AppPeople.dc.html, right panel), top to bottom:
 * avatar, name and "relation · Connected/Not connected"; their days with
 * countdowns; little things (emoji + text); their wishlist (first items with status and "See all", or
 * "Invite them"); then "Plan their day". Edit is the pencil at the top
 * right. From 1280px it sits next to the grid; below, it replaces the grid
 * and "All people" goes back.
 */
export function PersonPanel({
  person,
  onBack,
  onEdit,
  onInvite,
  headingRef,
  today,
  wishlist = null,
  className,
}: {
  person: PersonView;
  /** Their shared "My birthday" list, when you're connected (as you see it). */
  wishlist?: PersonWishlist | null;
  /** Today in the user's timezone, "2026-11-17" (past plans are before it). */
  today: string;
  onBack: () => void;
  onEdit: () => void;
  onInvite: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
  className?: string;
}) {
  const headingId = `person-${person.id}-name`;

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
          src={person.look?.photoUrl}
          character={person.look?.character}
          decorative
          className={cn("size-[68px]", person.look?.character ? "text-[36px]" : "text-22")}
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
          <span className="truncate text-14 text-sub">
            {[person.relationLabel, person.connected ? "Connected" : "Not connected"]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        {/* A 36px pencil circle to the eye, inside a 44px target. */}
        <Button
          variant="transparent"
          size="icon"
          onClick={onEdit}
          aria-label={`Edit ${person.name}`}
          className="group -mt-1 -mr-1 ml-auto self-start [--hover-tint:0%]"
        >
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-full bg-card2 transition-colors group-hover:bg-[color-mix(in_srgb,var(--text)_9%,var(--card2))]"
          >
            <PencilIcon className="size-4" />
          </span>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel id={`${headingId}-days`}>Days to remember</SectionLabel>
        <ul aria-labelledby={`${headingId}-days`} className="flex flex-col gap-2">
          {person.days.map((d) => (
            <li
              key={d.id}
              className="flex min-w-0 items-center gap-2.5 rounded-[16px] bg-card2 px-3.5 py-3"
            >
              <OccasionEmoji kind={d.kind} gentle={d.gentle} className="text-[20px]" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-15 font-bold [overflow-wrap:anywhere]">{d.title}</span>
                <span className="text-13 text-sub">{d.date}</span>
              </span>
              <span
                className={cn(
                  "shrink-0 text-right text-13 font-bold",
                  d.gentle ? "text-sub" : inkText[person.color],
                )}
              >
                {d.when}
              </span>
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
                key={`${i}-${t.text}`}
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-pill px-3 py-[7px] text-13 font-semibold [overflow-wrap:anywhere]",
                  pastelClasses[person.color],
                )}
              >
                <span aria-hidden>{t.emoji}</span>
                {t.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-14 text-sub">
            {person.inMemory
              ? "Nothing yet."
              : "Nothing yet. Add a little note about what they love."}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel id={`${headingId}-wishlist`}>Their wishlist</SectionLabel>
          {!person.inMemory && person.connected && wishlist && wishlist.wishes.length > 0 && (
            <Link
              href={`/wishlists?tab=friends&friend=${wishlist.friendId}`}
              className="inline-flex min-h-11 items-center text-14 font-semibold text-accent-text underline-offset-4 hover:underline"
            >
              See all<span className="sr-only"> of {person.name}&apos;s wishlist</span>
            </Link>
          )}
        </div>
        {person.inMemory ? (
          <p className="text-14 text-sub">In memory.</p>
        ) : person.connected ? (
          <TheirWishlist wishlist={wishlist} name={person.name} />
        ) : (
          <p className="flex flex-wrap items-center gap-x-2 text-14 text-sub">
            Not connected yet, so no shared wishlist.
            <button
              type="button"
              onClick={onInvite}
              className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-accent-text underline-offset-4 hover:underline"
            >
              Invite them<span className="sr-only">: {person.name}</span>
            </button>
          </p>
        )}
      </div>

      <PlanActions person={person} today={today} />

      <InMemorySwitch person={person} />
    </section>
  );
}

/**
 * "In memory": a quiet switch. On, every day of theirs is gentle: no
 * "turns N", no 🎂, no celebrating, in the app, emails and push.
 */
function InMemorySwitch({ person }: { person: PersonView }) {
  const router = useRouter();
  const [on, setOn] = React.useState(person.inMemory);
  const [message, setMessage] = React.useState("");
  const id = `in-memory-${person.id}`;
  const change = async (next: boolean) => {
    setOn(next);
    const result = await setInMemory(person.id, next);
    if (!result.ok) {
      setOn(!next);
      setMessage(result.message);
      return;
    }
    setMessage(next ? "Their days will be gentle from now on 🕊️" : "Saved");
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-[20px] bg-card2 px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-15 font-bold">
          In memory
        </label>
        <Switch
          id={id}
          aria-describedby={`${id}-hint`}
          checked={on}
          onCheckedChange={(next) => void change(next)}
        />
      </div>
      <p id={`${id}-hint`} className="text-13 text-sub">
        For someone who has passed. Their days are remembered gently, without celebratory
        countdowns.
      </p>
      <p role="status" aria-live="polite" className="text-13 text-sub empty:hidden">
        {message}
      </p>
    </div>
  );
}

/** The plan of a person's next day: what the sheet opens. */
export function personPlanTarget(person: PersonView, day: DayView): PlanTarget {
  const type = typeFor(day.kind, person.inMemory);
  const title = day.label === type.label ? null : day.label;
  const dayTitle = occasionTitle(person.name, day.kind, title);
  return {
    key: planKey(day.id, day.occursOn),
    occasionId: day.id,
    occursOn: day.occursOn,
    heading: day.kind === "birthday" && !day.gentle ? `${dayTitle} plan` : `Plan for ${dayTitle}`,
    date: day.shortDate,
    name: person.name,
    color: person.color,
    style: styleFor({ isYou: false, gentle: day.gentle }),
  };
}

/** As the People page loads it: the friend's id (for "See all") and their wishes. */
export type PersonWishlist = { friendId: string; wishes: FriendWish[] };

const STATUS: Record<FriendWish["status"], { label: string; className: string }> = {
  mine: { label: "Reserved by you", className: "text-mint-ink" },
  free: { label: "Free", className: "text-sub" },
  taken: { label: "Taken", className: "text-sub" },
};

/** The first few wishes on their list, with what's free, yours or taken (never by whom). */
function TheirWishlist({ wishlist, name }: { wishlist: PersonWishlist | null; name: string }) {
  const wishes = wishlist?.wishes ?? [];
  if (!wishlist || wishes.length === 0) {
    return <p className="text-14 text-sub">Nothing on {name}&apos;s wishlist yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {wishes.slice(0, 3).map((w) => {
        const price = formatPrice(w.price, w.currency);
        const status = STATUS[w.status];
        return (
          <li
            key={w.id}
            className="flex min-w-0 items-center gap-3 rounded-[16px] border-[1.5px] border-line px-3 py-2.5"
          >
            {w.imageUrl ? (
              // A signed Storage URL, already small: a plain <img> is right here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={w.imageUrl}
                alt=""
                className="size-10 shrink-0 rounded-[10px] object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center text-[24px] leading-none"
              >
                🎁
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-14 font-bold">{w.title}</span>
              {price && <span className="text-12 text-sub">{price}</span>}
            </span>
            <span className={cn("shrink-0 text-right text-12 font-bold", status.className)}>
              {status.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The panel's action: "Plan their day" (the plan of their next day, in a
 * sheet; "Plan the day" when it's gentle), full width on phones. Past years' plans stay
 * here below; private, only you ever see them.
 */
function PlanActions({ person, today }: { person: PersonView; today: string }) {
  const { plans } = usePlans();
  const [open, setOpen] = React.useState(false);
  const day = person.next;
  const target = day ? personPlanTarget(person, day) : null;
  const plan = target ? (plans.get(target.key) ?? null) : null;
  const { done, total } = progress(plan);
  const past = pastPlans(
    [...plans.values()],
    person.days.map((d) => d.id),
    today,
  );

  return (
    <div className="flex flex-col gap-2">
      {day && plan && (
        <div className="flex items-center gap-3 text-13 text-sub">
          <PlanDots plan={plan} color={person.color} />
          <span>
            {day.label} · {day.shortDate}: {done} of {total} done
          </span>
        </div>
      )}
      {day && target && (
        <Button onClick={() => setOpen(true)} className="w-full sm:w-auto sm:self-start">
          {day.gentle ? "Plan the day" : "Plan their day"}
        </Button>
      )}
      {past.length > 0 && (
        <details className="group rounded-[16px] px-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-14 font-semibold text-accent-text">
            Past plans ({past.length})
          </summary>
          <ul className="flex flex-col gap-2 pb-1">
            {past.map((p) => {
              const pastDay = person.days.find((d) => d.id === p.occasionId);
              const counts = progress(p);
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-0.5 rounded-[16px] bg-card2 px-3.5 py-3"
                >
                  <span className="text-14 font-bold">
                    {p.occursOn.slice(0, 4)} · {pastDay?.label ?? "A day"}
                  </span>
                  <span className="text-13 text-sub">
                    {counts.done} of {counts.total} done
                    {p.steps.some((st) => st.done) &&
                      `: ${p.steps
                        .filter((st) => st.done)
                        .map((st) => st.label)
                        .join(", ")}`}
                  </span>
                  {p.note && (
                    <span className="text-13 [overflow-wrap:anywhere]">&ldquo;{p.note}&rdquo;</span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {target && <PlanSheet target={target} open={open} onOpenChange={setOpen} />}
    </div>
  );
}
