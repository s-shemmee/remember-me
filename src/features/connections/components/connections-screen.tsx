"use client";

import { LinkIcon } from "lucide-react";
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

import { linkConnection, removeConnection, revokeInvite } from "../actions";
import { InviteLinkDialog } from "./invite-link-dialog";

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
 * Profile → connections (AppProfile.dc.html): "Invite your people" with
 * your open invites (Revoke), and "Connected with you" with "This is…"
 * (link to one of your People) and Remove.
 */
export function ConnectionsScreen({
  invites,
  connections,
  people,
}: {
  invites: PendingInvite[];
  connections: Connection[];
  people: LinkablePerson[];
}) {
  const router = useRouter();
  const [inviteKey, setInviteKey] = React.useState<number | null>(null);
  const [removing, setRemoving] = React.useState<Connection | null>(null);
  const [pending, startTransition] = React.useTransition();
  const inviteButton = React.useRef<HTMLButtonElement>(null);
  const connectionsHeading = React.useRef<HTMLHeadingElement>(null);

  const revoke = (invite: PendingInvite) =>
    startTransition(async () => {
      const result = await revokeInvite(invite.id);
      if (!result.ok) return void toast.error(result.message);
      toast("Invite cancelled. That link won't work any more.");
      router.refresh();
      inviteButton.current?.focus();
    });

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
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <section
        aria-labelledby="invite-heading"
        className="flex min-w-0 flex-col gap-4 rounded-[28px] bg-card p-6 shadow-card"
      >
        <h2 id="invite-heading" className="text-22 font-extrabold tracking-[-0.02em]">
          Invite your people
        </h2>
        <p className="text-15 text-sub">
          Send a link so they can add their own birthday and wishlist, and connect with you.
        </p>
        <Button ref={inviteButton} onClick={() => setInviteKey(Date.now())} className="w-fit">
          <LinkIcon aria-hidden /> Create an invite link
        </Button>
        <div className="flex flex-col gap-2">
          <h3 className="text-12 font-bold tracking-[.05em] text-sub uppercase">Open invites</h3>
          {invites.length ? (
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
          ) : (
            <p className="text-14 text-sub">No open invites.</p>
          )}
        </div>
      </section>

      <section
        aria-labelledby="connections-heading"
        className="flex min-w-0 flex-col gap-4 rounded-[28px] bg-card p-6 shadow-card"
      >
        <h2
          ref={connectionsHeading}
          id="connections-heading"
          tabIndex={-1}
          className="text-22 font-extrabold tracking-[-0.02em] outline-none"
        >
          Connected with you
        </h2>
        {connections.length ? (
          <ul className="flex flex-col gap-3">
            {connections.map((c) => {
              const options = people.filter(
                (p) => !p.linkedProfileId || p.linkedProfileId === c.profileId,
              );
              const selectId = `link-${c.id}`;
              return (
                <li key={c.id} className="flex flex-col gap-3 rounded-[20px] bg-card2 p-4">
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
        ) : (
          <p className="text-15 text-sub">
            No connections yet. When someone accepts your invite, they show up here.
          </p>
        )}
      </section>

      {inviteKey !== null && (
        <InviteLinkDialog
          key={inviteKey}
          open
          onOpenChange={(o) => !o && setInviteKey(null)}
          onCreated={() => router.refresh()}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            requestAnimationFrame(() => inviteButton.current?.focus());
          }}
        />
      )}

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
    </div>
  );
}
