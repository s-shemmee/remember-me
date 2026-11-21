"use client";

import { CheckIcon, ExternalLinkIcon, GiftIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { pastelClasses } from "@/components/ui/chip";
import { NoorBubble } from "@/components/ui/noor-bubble";
import { PRIORITIES } from "@/features/wishes/constants";
import { formatPrice, shopOf } from "@/features/wishes/schema";
import { PriorityIcon } from "@/features/wishes/priority-icon";
import { cn } from "@/lib/utils";
import { type Pastel, pastels } from "@/styles/tokens";

import {
  birthdayLine,
  type Friend,
  type FriendWish,
  friendSays,
  type Notice,
  type WishStatus,
} from "../logic";
import { Notices } from "./notices";
import { useReserve } from "./use-reserve";

const tile = (i: number): Pastel => pastels[i % pastels.length]!;

function FriendWishCard({
  wish,
  index,
  status,
  justTaken,
  busy,
  onReserve,
  onCancel,
}: {
  wish: FriendWish;
  index: number;
  status: WishStatus;
  justTaken: boolean;
  busy: boolean;
  onReserve: () => void;
  onCancel: () => void;
}) {
  const priority = PRIORITIES.find((p) => p.key === wish.priority)!;
  const price = formatPrice(wish.price, wish.currency);
  const shop = shopOf(wish.url);
  return (
    <li
      data-friend-wish-id={wish.id}
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-card bg-card p-4 shadow-card",
        status === "mine" && "ring-[2.5px] ring-mint-ink",
      )}
    >
      {wish.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL from a private bucket
        <img
          src={wish.imageUrl}
          alt=""
          className="aspect-[4/3] w-full rounded-[16px] bg-card2 object-cover"
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "grid aspect-[4/3] w-full place-items-center rounded-[16px]",
            pastelClasses[tile(index)],
          )}
        >
          <GiftIcon className="size-12" strokeWidth={1.5} />
        </span>
      )}
      <h3
        tabIndex={-1}
        className="text-16 leading-snug font-bold [overflow-wrap:anywhere] outline-none"
      >
        {wish.title}
      </h3>
      {(price || shop) && (
        <p className="text-14 [overflow-wrap:anywhere] text-sub">
          {[price, shop].filter(Boolean).join(" · ")}
        </p>
      )}
      {wish.note && <p className="text-13 [overflow-wrap:anywhere] text-sub">{wish.note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-card2 px-3 py-1 text-13 font-semibold">
          <PriorityIcon priority={priority.key} className="size-3.5 text-accent-text" />
          {priority.label}
        </span>
        {wish.url && (
          <a
            href={wish.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex min-h-11 items-center gap-1 text-13 font-semibold text-accent-text underline-offset-4 hover:underline"
          >
            <span aria-hidden>Open link</span>
            <ExternalLinkIcon aria-hidden className="size-3.5" />
            <span className="sr-only">Open link for {wish.title} (opens in a new tab)</span>
          </a>
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {status === "free" ? (
          <Button
            variant="card2"
            disabled={busy}
            onClick={onReserve}
            aria-label={`Reserve it: ${wish.title}`}
          >
            Reserve it
          </Button>
        ) : status === "mine" ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-mint px-3 py-1.5 text-13 font-semibold text-mint-ink">
              <CheckIcon aria-hidden className="size-3.5" /> Reserved by you
            </span>
            <Button
              variant="transparent"
              disabled={busy}
              onClick={onCancel}
              aria-label={`Cancel my reservation: ${wish.title}`}
            >
              Cancel
            </Button>
          </>
        ) : (
          <span className="rounded-pill bg-card2 px-3 py-1.5 text-13 font-semibold text-sub">
            <LockIcon aria-hidden className="mr-1 inline size-3.5 align-[-2px]" /> Already taken
          </span>
        )}
      </div>
      <p aria-live="polite" className="text-13 font-semibold text-accent-text empty:hidden">
        {justTaken ? "Just taken by someone else" : ""}
      </p>
    </li>
  );
}

/**
 * Friends' wishlists (AppWishlists, second tab): your connections, soonest
 * birthday first, and the chosen friend's "My birthday" wishes with Reserve
 * it 🤫. You see "Reserved by you" or "Already taken", never who.
 */
export function FriendsWishlists({
  friends,
  notices,
  friendId,
  onFriendChange,
}: {
  friends: Friend[];
  notices: Notice[];
  friendId: string | null;
  onFriendChange: (id: string) => void;
}) {
  const { statusOf, reserve, cancel, justTaken, busy } = useReserve();

  if (!friends.length) {
    return (
      <div className="flex flex-col gap-4">
        <Notices notices={notices} />
        <div className="flex max-w-xl flex-col gap-5 rounded-card-lg bg-card p-6 shadow-card sm:p-8">
          <NoorBubble className="[&_p]:bg-card2 [&_p]:shadow-none">
            When your people connect with you, their birthday wishlists show up here 💛
          </NoorBubble>
          <Button asChild variant="card2" className="w-fit">
            <Link href="/profile">Invite your people</Link>
          </Button>
        </div>
      </div>
    );
  }

  const friend = friends.find((f) => f.profileId === friendId) ?? friends[0]!;
  const shown = { ...friend, wishes: friend.wishes.map((w) => ({ ...w, status: statusOf(w) })) };

  return (
    <div className="flex flex-col gap-4">
      <Notices notices={notices} />
      <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div role="group" aria-label="Friends" className="-mx-1 overflow-x-auto px-1 pb-1">
          <ul className="flex gap-2 lg:flex-col">
            {friends.map((f) => {
              const on = f.profileId === friend.profileId;
              return (
                <li key={f.profileId} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => onFriendChange(f.profileId)}
                    className={cn(
                      "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[20px] hover-tint px-3 py-2.5 text-left",
                      on && "bg-card shadow-card",
                    )}
                  >
                    <Avatar name={f.name} pastel={f.pastel} character={f.character} decorative />
                    <span className="flex min-w-0 flex-col">
                      <span className="max-w-[18ch] truncate text-15 font-bold">{f.name}</span>
                      <span className="text-13 whitespace-nowrap text-sub">
                        {birthdayLine(f.daysUntil)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <section aria-labelledby="friend-list-title" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2
              id="friend-list-title"
              className="text-22 font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere]"
            >
              {friend.name}&apos;s birthday wishlist
            </h2>
            <p className="text-14 text-sub">
              {birthdayLine(friend.daysUntil)} · {friend.wishes.length}{" "}
              {friend.wishes.length === 1 ? "wish" : "wishes"}
            </p>
          </div>
          <NoorBubble live className="[&_p]:max-w-lg">
            {friendSays(shown)}
          </NoorBubble>
          {shown.wishes.length > 0 && (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.wishes.map((w, i) => (
                <FriendWishCard
                  key={w.id}
                  wish={w}
                  index={i}
                  status={w.status}
                  justTaken={justTaken === w.id}
                  busy={busy === w.id}
                  onReserve={() => void reserve(w, friend.name)}
                  onCancel={() => void cancel(w)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
