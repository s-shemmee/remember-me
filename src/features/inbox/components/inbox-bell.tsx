"use client";

import { BellIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { type InboxView, loadInbox, markInboxRead } from "../actions";

const WIDE = "(min-width: 640px)";
const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const useWide = () =>
  React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => true,
  );

/**
 * The header bell (behind NOTIFICATIONS_INBOX_ENABLED): an unread count, and
 * the inbox in a 380px popover (phones: a full-height sheet). Reminders sent,
 * invites accepted, and your people's wishlist updates; never anything about
 * reservations. Refreshed when the tab gets focus again.
 */
export function InboxBell() {
  const wide = useWide();
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<InboxView | null>(null);
  const [announce, setAnnounce] = React.useState("");

  const lastUnread = React.useRef<number | null>(null);
  const bellRef = React.useRef<HTMLButtonElement>(null);

  const apply = React.useCallback((next: InboxView | null) => {
    if (!next) return;
    // Say so when something new arrived since the last look (not on first load).
    if (lastUnread.current !== null && next.unread > lastUnread.current) {
      setAnnounce(`${next.unread} unread ${next.unread === 1 ? "notification" : "notifications"}`);
    }
    lastUnread.current = next.unread;
    setView(next);
  }, []);
  const refresh = React.useCallback(() => void loadInbox().then(apply), [apply]);

  // On load, and again whenever the tab gets focus (no realtime needed).
  React.useEffect(() => {
    let live = true;
    const load = () =>
      void loadInbox().then((next) => {
        if (live) apply(next);
      });
    load();
    window.addEventListener("focus", load);
    return () => {
      live = false;
      window.removeEventListener("focus", load);
    };
  }, [apply]);

  const unread = view?.unread ?? 0;
  const label = `Notifications${unread ? `, ${unread} unread` : ""}`;

  const markAll = async () => {
    setView((v) => v && { unread: 0, items: v.items.map((i) => ({ ...i, read: true })) });
    setAnnounce("All marked as read");
    lastUnread.current = 0;
    await markInboxRead({ ids: null });
  };
  const openItem = (id: string) => {
    setView(
      (v) =>
        v && {
          unread: v.items.filter((i) => !i.read && i.id !== id).length,
          items: v.items.map((i) => (i.id === id ? { ...i, read: true } : i)),
        },
    );
    setOpen(false);
    void markInboxRead({ ids: [id] });
  };

  const trigger = (
    <Button
      ref={bellRef}
      variant="page"
      size="icon"
      aria-label={label}
      className="relative"
      onClick={wide ? undefined : () => setOpen(true)}
    >
      <BellIcon aria-hidden />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-pill bg-accent px-1 text-12 font-bold text-on-accent"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Button>
  );

  const body = <InboxBody view={view} onMarkAll={() => void markAll()} onOpenItem={openItem} />;

  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
      {wide ? (
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) refresh();
          }}
        >
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            align="end"
            aria-labelledby="inbox-title"
            className="flex max-h-[min(560px,80dvh)] w-[min(380px,calc(100vw-32px))] flex-col p-0"
          >
            {body}
          </PopoverContent>
        </Popover>
      ) : (
        <>
          {trigger}
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (o) refresh();
            }}
          >
            <DialogContent
              className="flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 rounded-none p-0"
              onCloseAutoFocus={(event) => {
                // No Radix trigger here: give focus back to the bell (unless a link moved on).
                if (bellRef.current?.isConnected) {
                  event.preventDefault();
                  bellRef.current.focus();
                }
              }}
            >
              <InDialog value>{body}</InDialog>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}

function InboxBody({
  view,
  onMarkAll,
  onOpenItem,
}: {
  view: InboxView | null;
  onMarkAll: () => void;
  onOpenItem: (id: string) => void;
}) {
  const items = view?.items ?? [];
  const unread = view?.unread ?? 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 pr-14 sm:pr-4">
        <div className="flex flex-col">
          <DialogTitleOrHeading>Notifications</DialogTitleOrHeading>
          <span className="text-13 text-sub">{unread ? `${unread} unread` : "Nothing new"}</span>
        </div>
        <Button
          variant="transparent"
          className="px-3 text-14 text-accent-text"
          disabled={unread === 0}
          onClick={onMarkAll}
        >
          Mark all as read
        </Button>
      </div>

      {view === null ? (
        <p className="px-4 py-6 text-14 text-sub">Loading…</p>
      ) : items.length === 0 ? (
        <p className="px-4 py-8 text-center text-15 font-semibold">You&apos;re all caught up.</p>
      ) : (
        <ul aria-label="Notifications" className="min-h-0 flex-1 overflow-y-auto p-2">
          {items.map((i) => (
            <li key={i.id}>
              <Link
                href={i.href}
                onClick={() => onOpenItem(i.id)}
                className={cn(
                  "flex min-h-14 gap-3 rounded-[16px] hover-tint px-3 py-2.5",
                  !i.read && "bg-[color-mix(in_srgb,var(--accent)_9%,transparent)]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    i.read ? "bg-transparent" : "bg-accent",
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-14 [overflow-wrap:anywhere]">
                    {!i.read && <span className="sr-only">Unread: </span>}
                    {i.text}
                  </span>
                  <span className="text-12 text-sub">{i.when}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-line px-4 py-3 text-13 text-sub">
        Last 30 days ·{" "}
        <Link
          href="/settings/notifications"
          className="inline-flex min-h-11 items-center font-semibold text-accent-text underline-offset-4 hover:underline"
        >
          Notification settings
        </Link>
      </p>
    </div>
  );
}

/** A real dialog title in the phone sheet; a plain heading in the popover. */
function DialogTitleOrHeading({ children }: { children: React.ReactNode }) {
  const inDialog = React.useContext(InDialog);
  return inDialog ? (
    <>
      <DialogTitle className="text-17 font-bold">{children}</DialogTitle>
      <DialogDescription className="sr-only">
        Your notifications from the last 30 days.
      </DialogDescription>
    </>
  ) : (
    <h2 id="inbox-title" className="text-17 font-bold">
      {children}
    </h2>
  );
}

const InDialog = React.createContext(false);
