"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { pastelClasses } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Pastel } from "@/styles/tokens";

import { occasionTitle, typeFor } from "@/features/occasions/types";
import { GiftIdeasButton } from "@/features/gift-ideas/components/gift-ideas";
import { PlanDots } from "@/features/plans/components/plan-dots";
import { PlanSheet } from "@/features/plans/components/plan-sheet";
import { usePlans } from "@/features/plans/components/plan-state";
import { pastPlans, planKey, type PlanTarget, progress, styleFor } from "@/features/plans/steps";

import { setInMemory } from "../actions";
import type { DayView, PersonView } from "../view";

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
  onInvite,
  headingRef,
  today,
  giftIdeas = false,
  className,
}: {
  person: PersonView;
  /** Noor's gift ideas are switched on (AI_GIFT_IDEAS_ENABLED). */
  giftIdeas?: boolean;
  /** Today in the user's timezone, "2026-11-17" (past plans are before it). */
  today: string;
  onBack: () => void;
  onEdit: () => void;
  onInvite: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
  className?: string;
}) {
  const headingId = `person-${person.id}-name`;
  const ink = inkText[person.color];
  // Gift ideas are for their next day that isn't gentle; never "In memory".
  const giftDay = person.inMemory
    ? undefined
    : person.days.find((d) => !d.gentle && Number.isFinite(d.daysUntil));

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
          {(person.relationLabel || person.connected) && (
            <span className="truncate text-14 text-sub">
              {[person.relationLabel, person.connected ? "Connected" : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
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
              <span className={cn("shrink-0 text-13 font-bold", d.gentle ? "text-sub" : ink)}>
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
            {person.inMemory
              ? "Nothing yet."
              : "Nothing yet. Add what they love, so gift ideas come easy."}
          </p>
        )}
        {giftIdeas && giftDay && (
          <GiftIdeasButton
            className="self-start"
            target={{
              personId: person.id,
              name: person.name,
              occasionId: giftDay.id,
              occursOn: giftDay.occursOn,
            }}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel id={`${headingId}-wishlist`}>Their wishlist</SectionLabel>
        {person.inMemory ? (
          <p className="text-14 text-sub">In memory. No gift ideas here.</p>
        ) : person.connected ? (
          <p className="text-14 text-sub">
            Connected 💛 Their wishlist shows up here once sharing arrives.
          </p>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-14 text-sub">Not connected yet, so no shared wishlist.</p>
            <Button variant="card2" onClick={onInvite} className="max-w-full">
              <span className="truncate">Invite {person.name} to Remember Me</span>
            </Button>
          </div>
        )}
      </div>

      {person.next && <PlanSection person={person} day={person.next} today={today} />}

      <InMemorySwitch person={person} />

      <div className="flex flex-wrap gap-2">
        <Button variant="card2" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </section>
  );
}

/**
 * "In memory": a quiet switch. On, every day of theirs is gentle: no
 * "turns N", no 🎂, no celebrating, no gift actions, in the app, emails and push.
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
        For someone who has passed. Their days are remembered gently, with no countdowns to
        celebrate and no gift ideas.
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

/**
 * "Plan their day" for the next day, and the plans of past years (they stay
 * here; each year starts fresh). Private: only you ever see them.
 */
function PlanSection({ person, day, today }: { person: PersonView; day: DayView; today: string }) {
  const { plans } = usePlans();
  const [open, setOpen] = React.useState(false);
  const target = personPlanTarget(person, day);
  const plan = plans.get(target.key) ?? null;
  const { done, total } = progress(plan);
  const past = pastPlans(
    [...plans.values()],
    person.days.map((d) => d.id),
    today,
  );
  const headingId = `person-${person.id}-plan`;

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel id={headingId}>
        {day.gentle ? "Plan for the day" : "Plan their day"}
      </SectionLabel>
      <div className="flex flex-wrap items-center gap-3 rounded-[16px] bg-card2 px-3.5 py-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-15 font-bold [overflow-wrap:anywhere]">
            {day.label} · {day.shortDate}
          </span>
          <span className="text-13 text-sub">
            {plan ? `${done} of ${total} done` : "No plan yet"}
          </span>
        </span>
        {plan && <PlanDots plan={plan} color={person.color} />}
        <Button variant="transparent" onClick={() => setOpen(true)} className="bg-card">
          {plan ? "Open plan" : day.gentle ? "Plan the day" : "Plan their day"}
        </Button>
      </div>
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
      <PlanSheet target={target} open={open} onOpenChange={setOpen} />
    </div>
  );
}
