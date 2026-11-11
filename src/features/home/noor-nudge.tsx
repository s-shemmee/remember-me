"use client";

import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Noor } from "@/components/ui/noor";
import { useReserve } from "@/features/reservations/components/use-reserve";

/** "Later" hides the offer until tomorrow, in this browser only. */
const LATER_KEY = "rm-noor-later";

const readLater = () => {
  try {
    return window.localStorage.getItem(LATER_KEY);
  } catch {
    return null;
  }
};
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

export type NudgeOffer = {
  wishId: string;
  wishTitle: string;
  friendId: string;
  friendName: string;
  /** "Khalid turns 30 in 2 days 🎂 The match ball (350 MAD) on Khalid's wishlist is still free. …" */
  text: string;
};

/**
 * Noor's nudge on Home (AppHome). When the next birthday belongs to a
 * connected friend with a free wish, she offers to reserve it: "Reserve it 🤫"
 * reserves that wish (with Undo), "Later" waits until tomorrow.
 */
export function NoorNudge({
  text,
  personId,
  name,
  isYou,
  offer,
  today,
}: {
  text: string;
  personId: string | null;
  name: string | null;
  isYou: boolean;
  offer: NudgeOffer | null;
  /** Today in the user's timezone, "2026-11-11". */
  today: string;
}) {
  const { reserve, busy } = useReserve();
  const later = React.useSyncExternalStore(subscribe, readLater, () => null);
  const [state, setState] = React.useState<"offer" | "reserved" | "taken" | "later">("offer");
  const [reservedFor, setReservedFor] = React.useState<NudgeOffer | null>(null);

  const offering = offer && state === "offer" && later !== today;
  const said =
    state === "reserved"
      ? "Reserved! Only you know 🤫"
      : state === "taken"
        ? "Just taken by someone else. Their wishlist has more ideas 🎁"
        : state === "later"
          ? "No worries, I'll ask again tomorrow ☀️"
          : offering
            ? offer.text
            : text;
  const friend = reservedFor ?? offer;
  const sectionRef = React.useRef<HTMLElement>(null);
  // The buttons are replaced by a link: focus follows to it.
  const focusNext = () =>
    requestAnimationFrame(() =>
      sectionRef.current?.querySelector<HTMLElement>("a, button")?.focus(),
    );

  const onReserve = async () => {
    if (!offer) return;
    const result = await reserve({ id: offer.wishId, title: offer.wishTitle }, offer.friendName, {
      onUndone: () => setState("offer"),
    });
    if (result === "reserved") {
      setReservedFor(offer);
      setState("reserved");
      focusNext();
    } else if (result === "taken") {
      setReservedFor(offer);
      setState("taken");
      focusNext();
    }
  };
  const onLater = () => {
    try {
      window.localStorage.setItem(LATER_KEY, today);
    } catch {
      // Private mode: it just asks again next time.
    }
    setState("later");
    focusNext();
  };

  return (
    <section
      ref={sectionRef}
      aria-label="Noor"
      className="flex flex-wrap items-end gap-3.5 rounded-[28px] bg-linear-160 from-peach to-card px-5 py-5 sm:px-6"
    >
      <Noor size={58} mood="smiling" animated className="shrink-0" />
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
        <span className="pl-2.5 text-12 font-semibold text-sub">Noor · now</span>
        <p
          aria-live="polite"
          className="self-start rounded-[22px_22px_22px_6px] bg-card px-4 py-3 font-system text-16 leading-[1.4] [overflow-wrap:anywhere] shadow-card"
        >
          {said}
        </p>
      </div>
      {offering ? (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy === offer.wishId} onClick={() => void onReserve()}>
            Reserve it <span aria-hidden>🤫</span>
          </Button>
          <Button variant="card2" className="bg-card" onClick={onLater}>
            Later
          </Button>
        </div>
      ) : friend && (state === "reserved" || state === "taken") ? (
        <Button asChild variant="card2" className="bg-card">
          <Link href={`/wishlists?tab=friends&friend=${friend.friendId}`}>
            <span className="max-w-[24ch] truncate">See {friend.friendName}&apos;s wishlist</span>
          </Link>
        </Button>
      ) : personId ? (
        <Button asChild variant="card2" className="bg-card">
          <Link href={`/people?person=${personId}`}>
            <span className="max-w-[20ch] truncate">Open {name}</span>
          </Link>
        </Button>
      ) : isYou ? (
        <Button asChild variant="card2" className="bg-card">
          <Link href="/celebrate">Open Celebrate Me</Link>
        </Button>
      ) : null}
    </section>
  );
}
