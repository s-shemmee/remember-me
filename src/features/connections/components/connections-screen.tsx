"use client";

import { CheckIcon, ChevronDownIcon, LinkIcon, UsersIcon } from "lucide-react";
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

import { createInvite, linkConnection, removeConnection, revokeInvite } from "../actions";

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
  linkedPersonId: string | null;
  since: string;
};

export type LinkablePerson = { id: string; name: string; linkedProfileId: string | null };

/**
 * Profile → "Invite your people": Copy invite link makes a new link (7
 * days, once) and copies it ("Copied" for 2 seconds, announced). Your open
 * invites are listed with Cancel.
 */
export function InviteCard({ invites }: { invites: PendingInvite[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [status, setStatus] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [fallback, setFallback] = React.useState<string | null>(null);
  const copyButton = React.useRef<HTMLButtonElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () =>
    startTransition(async () => {
      setFallback(null);
      const result = await createInvite();
      if (!result.ok) return void setStatus(result.message);
      try {
        await navigator.clipboard.writeText(result.url);
        setCopied(true);
        setStatus("Copied. Your invite link is ready to paste.");
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          setCopied(false);
          setStatus("");
        }, 2000);
      } catch {
        // No clipboard (an old browser, or permission refused): show it to copy by hand.
        setFallback(result.url);
        setStatus("Here's your link. Copy it from the box.");
      }
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
          Send a link so they can add their own birthday and wishlist, and connect with you.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button ref={copyButton} onClick={copy} disabled={pending} className="w-fit">
          {copied ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
          {copied ? "Copied" : "Copy invite link"}
        </Button>
        <p role="status" aria-live="polite" className="text-14 text-sub empty:hidden">
          {status}
        </p>
      </div>
      {fallback && (
        <input
          readOnly
          aria-label="Your invite link"
          value={fallback}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 w-full rounded-input border-[1.5px] border-line bg-card2 px-4 text-15"
        />
      )}
      {invites.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-12 font-bold tracking-[.05em] text-sub uppercase">Open invites</h3>
          <ul className="flex flex-col gap-2">
            {invites.map((i) => (
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
        </div>
      )}
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
        className="flex min-w-0 flex-col gap-4 rounded-card-lg bg-card p-6 shadow-card"
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
            <ul aria-label="Your connections" className="flex flex-wrap gap-4">
              {connections.map((c) => (
                <li key={c.id} className="flex w-16 flex-col items-center gap-1.5">
                  <Avatar name={c.name} pastel={c.color} character={c.character} decorative />
                  <span className="w-full truncate text-center text-13 font-semibold">
                    {c.name}
                  </span>
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
                        <Avatar name={c.name} pastel={c.color} character={c.character} decorative />
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
