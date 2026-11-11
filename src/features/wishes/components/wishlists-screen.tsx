"use client";

import { EllipsisIcon, ExternalLinkIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FilterChip, pastelClasses } from "@/components/ui/chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NoorBubble } from "@/components/ui/noor-bubble";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { type Pastel, pastels } from "@/styles/tokens";

import { removeWish, reorderWishes, restoreWish } from "../actions";
import { PRIORITIES } from "../constants";
import type { Wish, Wishlist } from "../load";
import { formatPrice, shopOf, type WishFormValues } from "../schema";
import { emptyWishForm, WishDialog, wishToForm } from "./wish-dialog";

const tile = (i: number): Pastel => pastels[i % pastels.length]!;

const listLine = (list: Wishlist) => {
  const count = `${list.wishes.length} ${list.wishes.length === 1 ? "wish" : "wishes"}`;
  return list.kind === "treat"
    ? `Just for you. Only you can see this list · ${count}`
    : `Your connections will see this list once sharing arrives · ${count}`;
};

function WishCard({
  wish,
  index,
  total,
  onEdit,
  onMove,
  onRemove,
}: {
  wish: Wish;
  index: number;
  total: number;
  onEdit: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const priority = PRIORITIES.find((p) => p.key === wish.priority)!;
  const price = formatPrice(wish.price, wish.currency);
  const shop = shopOf(wish.url);
  return (
    <li
      data-wish-id={wish.id}
      className="relative flex min-w-0 flex-col gap-2.5 rounded-card bg-card p-4 shadow-card"
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
            "grid aspect-[4/3] w-full place-items-center rounded-[16px] text-[40px]",
            pastelClasses[tile(index)],
          )}
        >
          🎁
        </span>
      )}
      {/* The menu sits on the photo: first in the Tab order, as it looks. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="transparent"
            size="icon"
            className="absolute top-6 right-6 bg-card shadow-card hover:bg-card2"
            aria-label={`Options for ${wish.title}`}
          >
            <EllipsisIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
            Move earlier
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === total - 1} onSelect={() => onMove(1)}>
            Move later
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="accent" onSelect={onRemove}>
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <h3 className="text-16 leading-snug font-bold [overflow-wrap:anywhere]">{wish.title}</h3>
      {(price || shop) && (
        <p className="text-14 [overflow-wrap:anywhere] text-sub">
          {[price, shop].filter(Boolean).join(" · ")}
        </p>
      )}
      {wish.note && <p className="text-13 [overflow-wrap:anywhere] text-sub">{wish.note}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <span className="rounded-pill bg-card2 px-3 py-1 text-13 font-semibold">
          <span aria-hidden>{priority.emoji} </span>
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
            <span className="sr-only">Open link (opens in a new tab)</span>
          </a>
        )}
      </div>
    </li>
  );
}

/**
 * Wishlists (AppWishlists.dc.html), part 1: your own two lists. Add, edit,
 * reorder (Move earlier / later in each wish's menu) and remove with Undo.
 * Friends' wishlists come with sharing (M3 part 2).
 */
export function WishlistsScreen({ lists, userId }: { lists: Wishlist[]; userId: string }) {
  const router = useRouter();
  const [listId, setListId] = React.useState(lists[0]?.id ?? "");
  const [order, setOrder] = React.useState<Record<string, string[]>>({});
  const [dialog, setDialog] = React.useState<{
    key: number;
    initial: WishFormValues;
    imageUrl: string | null;
  } | null>(null);
  const opener = React.useRef<HTMLElement | null>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);

  const list = lists.find((l) => l.id === listId) ?? lists[0];
  // A local order while a move is saving, so the card moves at once.
  const wishes = React.useMemo(() => {
    if (!list) return [];
    const ids = order[list.id];
    if (!ids) return list.wishes;
    const byId = new Map(list.wishes.map((w) => [w.id, w]));
    const known = ids.map((id) => byId.get(id)).filter((w): w is Wish => Boolean(w));
    return [...known, ...list.wishes.filter((w) => !ids.includes(w.id))];
  }, [list, order]);

  if (!list) return null;

  const open = (initial: WishFormValues, imageUrl: string | null) => {
    opener.current = document.activeElement as HTMLElement | null;
    setDialog({ key: Date.now(), initial, imageUrl });
  };

  const move = async (index: number, delta: -1 | 1) => {
    const ids = wishes.map((w) => w.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved!);
    setOrder((o) => ({ ...o, [list.id]: ids }));
    const result = await reorderWishes({ wishlistId: list.id, ids });
    if (!result.ok) {
      setOrder((o) => ({ ...o, [list.id]: wishes.map((w) => w.id) }));
      toast.error(result.message);
      return;
    }
    toast(`Moved ${delta < 0 ? "earlier" : "later"}`);
    router.refresh();
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-wish-id="${moved}"] button[aria-label^="Options"]`)
        ?.focus(),
    );
  };

  const remove = async (wish: Wish) => {
    const result = await removeWish(wish.id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    router.refresh();
    titleRef.current?.focus();
    toast(`${wish.title} removed`, {
      action: {
        label: "Undo",
        onClick: async () => {
          const undone = await restoreWish(wish.id);
          if (undone.ok) {
            router.refresh();
            toast.success(`${wish.title} is back`);
          } else toast.error(undone.message);
        },
      },
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <h1
            ref={titleRef}
            tabIndex={-1}
            className="text-34 leading-tight font-extrabold tracking-[-0.03em] outline-none"
          >
            Wishlists
          </h1>
          <p className="text-15 text-sub">What you hope for, and what your people do</p>
        </div>
        <Button onClick={() => open(emptyWishForm(list.id), null)}>
          <PlusIcon aria-hidden /> Add a wish
        </Button>
      </div>

      <Tabs defaultValue="mine" className="flex flex-col gap-5">
        <TabsList aria-label="Wishlists" className="self-start">
          <TabsTrigger value="mine">My wishlists</TabsTrigger>
          <TabsTrigger value="friends">Friends&apos; wishlists</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <div role="group" aria-label="My lists" className="flex flex-wrap gap-1.5">
                {lists.map((l) => (
                  <FilterChip
                    key={l.id}
                    selected={l.id === list.id}
                    onClick={() => setListId(l.id)}
                    className={l.id === list.id ? undefined : "bg-card"}
                  >
                    {l.label}
                  </FilterChip>
                ))}
              </div>
              <h2 className="text-22 font-extrabold tracking-[-0.02em]">
                {list.kind === "birthday" ? "My birthday wishlist" : list.title}
              </h2>
              <p className="text-14 text-sub">{listLine(list)}</p>
            </div>
          </div>

          {wishes.length ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {wishes.map((w, i) => (
                <WishCard
                  key={w.id}
                  wish={w}
                  index={i}
                  total={wishes.length}
                  onEdit={() => open(wishToForm(w), w.imageUrl)}
                  onMove={(delta) => void move(i, delta)}
                  onRemove={() => void remove(w)}
                />
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => open(emptyWishForm(list.id), null)}
                  className="flex h-full min-h-[200px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-line p-4 text-sub hover:bg-card2"
                >
                  <PlusIcon aria-hidden className="size-6" />
                  <span className="text-15 font-bold text-text">Add a wish</span>
                  <span className="text-13">paste a link or type it</span>
                </button>
              </li>
            </ul>
          ) : (
            <div className="flex max-w-xl flex-col gap-5 rounded-card-lg bg-card p-6 shadow-card sm:p-8">
              <NoorBubble className="[&_p]:bg-card2 [&_p]:shadow-none">
                Add the first thing you&apos;d love. I&apos;ll keep the surprises secret 🤫
              </NoorBubble>
              <Button onClick={() => open(emptyWishForm(list.id), null)} className="w-fit">
                <PlusIcon aria-hidden /> Add a wish
              </Button>
            </div>
          )}

          <p className="rounded-[20px] bg-card2 px-4 py-3.5 text-14 text-sub">
            <span aria-hidden>🤫 </span>When someone reserves a gift, you&apos;ll only see
            &ldquo;Someone&apos;s got this&rdquo;. Never who. Surprises stay surprises.
          </p>
        </TabsContent>

        <TabsContent value="friends">
          <div className="flex max-w-xl flex-col gap-5 rounded-card-lg bg-card p-6 shadow-card sm:p-8">
            <NoorBubble className="[&_p]:bg-card2 [&_p]:shadow-none">
              Your people&apos;s wishlists arrive in the next update. Invite them now, so
              they&apos;re ready 💛
            </NoorBubble>
            <Button asChild variant="card2" className="w-fit">
              <Link href="/profile">Invite your people</Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {dialog && (
        <WishDialog
          key={dialog.key}
          open
          onOpenChange={(o) => {
            if (!o) {
              setDialog(null);
            }
          }}
          initial={dialog.initial}
          initialImageUrl={dialog.imageUrl}
          lists={lists}
          userId={userId}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            requestAnimationFrame(() => (opener.current ?? titleRef.current)?.focus());
          }}
          onSaved={(r) => {
            setDialog(null);
            setOrder({});
            router.refresh();
            toast.success(r.added ? `${r.title} added` : `${r.title} saved`);
          }}
        />
      )}
    </>
  );
}
