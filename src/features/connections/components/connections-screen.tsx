"use client";

import { CheckIcon, ChevronDownIcon, LinkIcon, RotateCcwIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { toast } from "@/components/ui/sonner";
import type { Pastel } from "@/styles/tokens";

import { linkConnection, removeConnection, resetInviteLink, revokeInvite } from "../actions";

export type PendingInvite = {
  id: string;
  personName: string | null;
  /** "Expires in 6 days", "Expires today". */
  expires: string;
  /** "Made Tue, 10 Nov". */
  made: string;
};

export type Connection = {
  id: string;
  profileId: string;
  name: string;
  color: Pastel;
  character: string | null;
  /** A signed URL for their photo, when that's their avatar. */
  photoUrl?: string | null;
  linkedPersonId: string | null;
  since: string;
};

export type LinkablePerson = { id: string; name: string; linkedProfileId: string | null };

/** Open invites shown before "Show all". */
const INVITES_SHOWN = 5;

/**
 * Profile → "Invite your people": your personal link (made once, loaded with
 * the page, the same every time; anyone with it can connect), Copy (only
 * copies) and "Reset link" (asks first; the old link stops working). Below,
 * your open invites for your people (7 days, once), newest 5 then "Show
 * all", each with Cancel.
 */
export function InviteCard({
  link: initialLink,
  invites,
}: {
  link: string | null;
  invites: PendingInvite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [link, setLink] = React.useState(initialLink);
  const [status, setStatus] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const field = React.useRef<HTMLInputElement>(null);
  const copyButton = React.useRef<HTMLButtonElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setStatus("Copied. Your invite link is ready to paste.");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopied(false);
        setStatus("");
      }, 2000);
    } catch {
      // No clipboard (an old browser, or permission refused): copy it from the field.
      setStatus("Copy it from the box.");
      field.current?.select();
    }
  };

  const reset = () =>
    startTransition(async () => {
      const result = await resetInviteLink();
      setConfirmReset(false);
      if (!result.ok) return void setStatus(result.message);
      setLink(result.url);
      setCopied(false);
      setStatus("New link ready. The old one no longer works.");
      router.refresh();
    });

  const revoke = (invite: PendingInvite) =>
    startTransition(async () => {
      const result = await revokeInvite(invite.id);
      if (!result.ok) return void toast.error(result.message);
      toast("Invite cancelled. That link won't work any more.");
      router.refresh();
      copyButton.current?.focus();
    });

  const shown = showAll ? invites : invites.slice(0, INVITES_SHOWN);

  return (
    <section
      aria-labelledby="invite-heading"
      className="flex min-w-0 flex-col gap-4 rounded-card-lg bg-card p-6 shadow-card"
    >
      <div className="flex flex-col gap-1">
        <h2 id="invite-heading" className="text-22 font-extrabold tracking-[-0.02em]">
          Invite your people
        </h2>
        <p className="text-15 text-sub">
          Anyone with your link can connect and share their wishlist.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-link" className="text-14 font-semibold">
          Your invite link
        </label>
        <div className="flex min-w-0 items-center gap-2">
          <input
            ref={field}
            id="invite-link"
            readOnly
            value={link ?? ""}
            placeholder="Your link isn't ready yet"
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 w-full min-w-0 flex-1 truncate rounded-input border-[1.5px] border-line bg-card2 px-4 text-15 placeholder:text-sub"
          />
          <Button
            ref={copyButton}
            onClick={() => void copy()}
            disabled={!link}
            className="shrink-0"
          >
            {copied ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p role="status" aria-live="polite" className="text-14 text-sub empty:hidden">
          {status || (link ? "" : "I couldn't make your link just now. Try again later.")}
        </p>
        {link && (
          <Button
            variant="transparent"
            onClick={() => setConfirmReset(true)}
            disabled={pending}
            className="self-start px-3 text-accent-text"
          >
            <RotateCcwIcon aria-hidden className="size-4" /> Reset link
          </Button>
        )}
      </div>
      {invites.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-12 font-bold tracking-[.05em] text-sub uppercase">
            Invites for your people
          </h3>
          <ul className="flex flex-col gap-2">
            {shown.map((i) => (
              <li
                key={i.id}
                className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-[16px] bg-card2 py-2 pr-2 pl-4"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-15 font-semibold">
                    {i.personName ? `For ${i.personName}` : "Invite link"}
                  </span>
                  <span className="text-13 text-sub">
                    {i.made} · {i.expires}
                  </span>
                </span>
                <Button
                  variant="transparent"
                  onClick={() => revoke(i)}
                  disabled={pending}
                  className="text-accent-text"
                  aria-label={`Cancel ${i.personName ? `the invite for ${i.personName}` : "this invite"}, ${i.made.toLowerCase()}`}
                >
                  Cancel
                </Button>
              </li>
            ))}
          </ul>
          {invites.length > INVITES_SHOWN && (
            <Button
              variant="transparent"
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
              className="self-start px-3 text-accent-text"
            >
              {showAll ? "Show fewer" : `Show all (${invites.length})`}
            </Button>
          )}
        </div>
      )}

      <Dialog open={confirmReset} onOpenChange={(o) => !pending && setConfirmReset(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your link?</DialogTitle>
            <DialogDescription>
              Your current link stops working right away. Anyone who hasn&apos;t used it yet will
              need the new one.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="card2"
              onClick={() => setConfirmReset(false)}
              disabled={pending}
              autoFocus
            >
              Keep this link
            </Button>
            <Button onClick={reset} aria-disabled={pending || undefined}>
              {pending ? "Resetting…" : "Reset link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/**
 * Profile → "Connected with you": their avatars and a link to all your
 * people. "Manage connections" opens "This is…" (link to one of your
 * People) and Remove for each.
 */
export function ConnectedCard({
  connections,
  people,
}: {
  connections: Connection[];
  people: LinkablePerson[];
}) {
  const router = useRouter();
  const [removing, setRemoving] = React.useState<Connection | null>(null);
  const [pending, startTransition] = React.useTransition();
  const connectionsHeading = React.useRef<HTMLHeadingElement>(null);

  const link = (c: Connection, personId: string) =>
    startTransition(async () => {
      const result = await linkConnection({
        profileId: c.profileId,
        personId: personId || null,
        currentPersonId: c.linkedPersonId,
      });
      if (!result.ok) return void toast.error(result.message);
      const person = people.find((p) => p.id === personId);
      toast.success(person ? `${c.name} is ${person.name} in your People` : `${c.name} unlinked`);
      router.refresh();
    });

  const remove = (c: Connection) =>
    startTransition(async () => {
      const result = await removeConnection(c.id);
      setRemoving(null);
      if (!result.ok) return void toast.error(result.message);
      toast(`You and ${c.name} are no longer connected`);
      router.refresh();
    });

  return (
    <>
      <section
        aria-labelledby="connections-heading"
        className="flex min-w-0 flex-col gap-4 rounded-card-lg bg-card p-6 shadow-card sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            ref={connectionsHeading}
            id="connections-heading"
            tabIndex={-1}
            className="text-22 font-extrabold tracking-[-0.02em] outline-none"
          >
            Connected with you
          </h2>
          <Link
            href="/people"
            className="inline-flex min-h-11 items-center text-14 font-semibold text-accent-text underline-offset-4 hover:underline"
          >
            All people
          </Link>
        </div>
        {connections.length ? (
          <>
            <ul aria-label="Your connections" className="flex flex-wrap gap-2">
              {connections.map((c) => (
                <li
                  key={c.id}
                  className="flex max-w-full min-w-0 items-center gap-2 rounded-pill bg-card2 py-1 pr-4 pl-1"
                >
                  <Avatar
                    name={c.name}
                    pastel={c.color}
                    src={c.photoUrl}
                    character={c.character}
                    size="sm"
                    decorative
                  />
                  <span className="truncate text-14 font-semibold">{c.name}</span>
                </li>
              ))}
            </ul>
            <details className="group rounded-[20px] bg-card2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-[20px] px-4 text-15 font-semibold [&::-webkit-details-marker]:hidden">
                Manage connections
                <ChevronDownIcon
                  aria-hidden
                  className="size-5 text-sub transition-transform group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <ul className="flex flex-col gap-3 px-3 pb-3">
                {connections.map((c) => {
                  const options = people.filter(
                    (p) => !p.linkedProfileId || p.linkedProfileId === c.profileId,
                  );
                  const selectId = `link-${c.id}`;
                  return (
                    <li key={c.id} className="flex flex-col gap-3 rounded-[16px] bg-card p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          name={c.name}
                          pastel={c.color}
                          src={c.photoUrl}
                          character={c.character}
                          decorative
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-16 font-bold">{c.name}</span>
                          <span className="text-13 text-sub">Connected since {c.since}</span>
                        </span>
                        <Button
                          variant="transparent"
                          onClick={() => setRemoving(c)}
                          disabled={pending}
                          className="text-accent-text"
                          aria-label={`Remove ${c.name} from your connections`}
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="grid gap-1.5">
                        <label htmlFor={selectId} className="text-14 font-semibold">
                          This is…
                        </label>
                        <SelectField
                          id={selectId}
                          value={c.linkedPersonId ?? ""}
                          disabled={pending}
                          onChange={(e) => link(c, e.currentTarget.value)}
                        >
                          <option value="">Not in my People</option>
                          {options.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </SelectField>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </details>
          </>
        ) : (
          <div className="flex flex-col items-start gap-1 rounded-[20px] bg-card2 p-4">
            <UsersIcon aria-hidden className="size-6 text-accent-text" />
            <p className="text-15 font-bold">No connections yet</p>
            <p className="text-14 text-sub">When someone accepts your invite, they show up here.</p>
          </div>
        )}
      </section>

      <Dialog open={removing !== null} onOpenChange={(o) => !o && !pending && setRemoving(null)}>
        <DialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            requestAnimationFrame(() => connectionsHeading.current?.focus());
          }}
        >
          <DialogHeader>
            <DialogTitle className="[overflow-wrap:anywhere]">Remove {removing?.name}?</DialogTitle>
            <DialogDescription>
              You&apos;ll stop seeing each other&apos;s shared things. If they&apos;re in your
              People, they stay there.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="card2" onClick={() => setRemoving(null)} disabled={pending} autoFocus>
              Keep
            </Button>
            <Button
              onClick={() => removing && remove(removing)}
              aria-disabled={pending || undefined}
            >
              {pending ? "Removing…" : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
