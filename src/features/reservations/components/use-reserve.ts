"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { toast } from "@/components/ui/sonner";

import { cancelReservation, reserveWish } from "../actions";
import type { WishStatus } from "../logic";

/**
 * After a change the card's button is replaced (Reserve it ↔ Cancel), so
 * focus moves to the card's new control, or to its title when it's taken.
 */
function focusCard(id: string) {
  requestAnimationFrame(() => {
    const card = document.querySelector<HTMLElement>(`[data-friend-wish-id="${id}"]`);
    (card?.querySelector<HTMLElement>("button") ?? card?.querySelector<HTMLElement>("h3"))?.focus();
  });
}

/**
 * Reserve and cancel with an instant local status, an Undo toast
 * ("Reserved for Khalid 🤫 · Undo", 6 seconds), and "Just taken by someone
 * else" when another friend won the race.
 */
export function useReserve() {
  const router = useRouter();
  const [overrides, setOverrides] = React.useState<Record<string, WishStatus>>({});
  const [justTaken, setJustTaken] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const statusOf = React.useCallback(
    (wish: { id: string; status: WishStatus }) => overrides[wish.id] ?? wish.status,
    [overrides],
  );
  const set = (id: string, status: WishStatus) => setOverrides((o) => ({ ...o, [id]: status }));

  const cancel = async (wish: { id: string; title: string }, { undo = false } = {}) => {
    setBusy(wish.id);
    set(wish.id, "free");
    const result = await cancelReservation(wish.id);
    setBusy(null);
    if (!result.ok) {
      set(wish.id, "mine");
      toast.error(result.message);
      return false;
    }
    router.refresh();
    focusCard(wish.id);
    toast(undo ? "Undone. It's free again" : `${wish.title} is free again`);
    return true;
  };

  const reserve = async (
    wish: { id: string; title: string },
    friendName: string,
    { onUndone }: { onUndone?: () => void } = {},
  ): Promise<"reserved" | "taken" | "failed"> => {
    setBusy(wish.id);
    setJustTaken(null);
    set(wish.id, "mine");
    const result = await reserveWish(wish.id);
    setBusy(null);
    if (!result.ok) {
      if (result.code === "taken") {
        set(wish.id, "taken");
        setJustTaken(wish.id);
      } else {
        set(wish.id, "free");
        toast.error(result.message);
      }
      focusCard(wish.id);
      router.refresh();
      return result.code === "taken" ? "taken" : "failed";
    }
    router.refresh();
    focusCard(wish.id);
    toast(`Reserved for ${friendName} 🤫`, {
      action: {
        label: "Undo",
        onClick: () =>
          void cancel(wish, { undo: true }).then((undone) => {
            if (undone) onUndone?.();
          }),
      },
    });
    return "reserved";
  };

  return { statusOf, reserve, cancel, justTaken, busy };
}
