"use client";

import { Link2Icon, SearchIcon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DateFields } from "@/components/ui/date-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { toast } from "@/components/ui/sonner";
import {
  addPersonFromConnection,
  linkPersonToAccount,
  unlinkPersonFromAccount,
  applyAccountBirthday,
} from "@/features/connections/actions";
import { type DayMonth, formatDayMonth } from "@/lib/dates";
import type { Pastel } from "@/styles/tokens";

/** One of your connections' accounts, as you may see it (my_friends()). */
export type Account = {
  profileId: string;
  /** Their own first name (not the name you gave them). */
  firstName: string;
  /** Which of your people they are, if any. */
  linkedPersonId: string | null;
  /** Their birthday, only when they share it. */
  birthday: DayMonth | null;
  pastel: Pastel;
  photoUrl: string | null;
  character: string | null;
};

/** One of your people you could link (not linked yet, not "In memory"). */
export type LinkCandidate = { id: string; name: string; color: Pastel; birthday: DayMonth | null };

/**
 * "Their profile says 3 March. Use theirs?" after linking, when their
 * shared birthday differs from yours. Never changed without asking.
 */
function BirthdayQuestion({
  personId,
  theirs,
  onDone,
}: {
  personId: string;
  theirs: DayMonth;
  onDone: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState("");
  const useTheirs = () =>
    startTransition(async () => {
      const result = await applyAccountBirthday(personId);
      if (!result.ok) return void setMessage(result.message);
      toast.success("Birthday updated");
      onDone();
    });
  return (
    <div role="group" aria-labelledby="birthday-question" className="flex flex-col gap-3">
      <p id="birthday-question" className="text-15 font-semibold">
        Their profile says {formatDayMonth(theirs)}. Use theirs?
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={useTheirs} aria-disabled={pending || undefined}>
          Use theirs
        </Button>
        <Button variant="card2" onClick={onDone} disabled={pending}>
          Keep mine
        </Button>
      </div>
      <p aria-live="polite" className="text-14 font-semibold text-accent-text empty:hidden">
        {message}
      </p>
    </div>
  );
}

/**
 * People: someone joined through your personal link and isn't one of your
 * people yet. A banner, then "Is this someone you already added?": pick one
 * of your people to link (searchable), or "No, add as new". Never matched
 * for you by name or email.
 */
export function LinkPrompt({
  joiners,
  candidates,
  openFor,
}: {
  joiners: Account[];
  candidates: LinkCandidate[];
  /** ?link=<profile id> from the bell: open the question for them. */
  openFor?: string | null;
}) {
  const router = useRouter();
  const first = joiners.find((j) => j.profileId === openFor) ?? joiners[0];
  const [open, setOpen] = React.useState(Boolean(openFor && first?.profileId === openFor));
  if (!first) return null;
  const others = joiners.length - 1;
  return (
    <section
      aria-label="New connection"
      className="flex flex-wrap items-center gap-4 rounded-card-lg bg-card p-5 shadow-card"
    >
      <Avatar
        name={first.firstName}
        pastel={first.pastel}
        src={first.photoUrl}
        character={first.character}
        decorative
      />
      <p className="min-w-0 flex-1 basis-[240px] text-15">
        <strong>{first.firstName}</strong> joined through your link. Is this someone you already
        added?
        {others > 0 && (
          <span className="text-sub">
            {" "}
            ({others} more {others === 1 ? "person" : "people"} joined too.)
          </span>
        )}
      </p>
      <Button onClick={() => setOpen(true)}>Choose</Button>
      {open && (
        <LinkDialog
          key={first.profileId}
          account={first}
          candidates={candidates}
          onClose={(changed) => {
            setOpen(false);
            if (changed) router.refresh();
          }}
        />
      )}
    </section>
  );
}

function LinkDialog({
  account,
  candidates,
  onClose,
}: {
  account: Account;
  candidates: LinkCandidate[];
  onClose: (changed: boolean) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState("");
  const [birthday, setBirthday] = React.useState<{ day: number | null; month: number | null }>({
    day: null,
    month: null,
  });
  const [asked, setAsked] = React.useState<{ personId: string; theirs: DayMonth } | null>(null);
  const searchId = React.useId();
  const q = query.trim().toLowerCase();
  const shown = candidates.filter((c) => !q || c.name.toLowerCase().includes(q));

  const link = (person: LinkCandidate) =>
    startTransition(async () => {
      const result = await linkPersonToAccount({
        personId: person.id,
        profileId: account.profileId,
      });
      if (!result.ok) return void setMessage(result.message);
      toast.success(`${person.name} is linked to ${account.firstName}'s account`);
      if (result.theirBirthday) setAsked({ personId: person.id, theirs: result.theirBirthday });
      else onClose(true);
    });

  const addNew = () =>
    startTransition(async () => {
      const result = await addPersonFromConnection({
        profileId: account.profileId,
        day: account.birthday ? null : birthday.day,
        month: account.birthday ? null : birthday.month,
      });
      if (!result.ok) return void setMessage(result.message);
      toast.success(`${account.firstName} is in your people`);
      onClose(true);
    });

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose(Boolean(asked))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Is {account.firstName} someone you already added?</DialogTitle>
          <DialogDescription>
            Link them to one of your people, or add them as new. Your name for them, your notes and
            dates stay yours.
          </DialogDescription>
        </DialogHeader>

        {asked ? (
          <BirthdayQuestion
            personId={asked.personId}
            theirs={asked.theirs}
            onDone={() => onClose(true)}
          />
        ) : (
          <>
            {candidates.length > 0 && (
              <div className="flex flex-col gap-2">
                <label htmlFor={searchId} className="text-14 font-semibold">
                  Your people
                </label>
                <div className="relative">
                  <SearchIcon
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-sub"
                  />
                  <input
                    id={searchId}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.currentTarget.value)}
                    placeholder="Search your people…"
                    autoComplete="off"
                    className="min-h-11 w-full rounded-pill border-[1.5px] border-line bg-card pr-4 pl-11 text-15 placeholder:text-sub focus:border-accent focus:outline-none"
                  />
                </div>
                <ul
                  aria-label="People you could link"
                  className="flex max-h-64 flex-col gap-1.5 overflow-y-auto"
                >
                  {shown.map((c) => (
                    <li
                      key={c.id}
                      className="flex min-w-0 items-center gap-3 rounded-[16px] bg-card2 py-2 pr-2 pl-3"
                    >
                      <Avatar name={c.name} pastel={c.color} size="sm" decorative />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-15 font-semibold">{c.name}</span>
                        {c.birthday && (
                          <span className="text-13 text-sub">
                            Birthday {formatDayMonth(c.birthday)}
                          </span>
                        )}
                      </span>
                      <Button
                        variant="card"
                        onClick={() => link(c)}
                        disabled={pending}
                        aria-label={`Link ${c.name}`}
                      >
                        <Link2Icon aria-hidden /> Link
                      </Button>
                    </li>
                  ))}
                  {shown.length === 0 && (
                    <li className="px-1 text-14 text-sub">No one by that name.</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <p className="text-15 font-semibold">No, {account.firstName} is new</p>
              {!account.birthday && (
                <DateFields
                  idPrefix="link-new-birthday"
                  legend="Their birthday"
                  hint="They don't share theirs, so add it here."
                  value={{ ...birthday, year: null }}
                  onChange={(patch) => setBirthday((b) => ({ ...b, ...patch }))}
                  errors={{}}
                />
              )}
              <Button variant="card2" onClick={addNew} disabled={pending} className="self-start">
                <UserPlusIcon aria-hidden /> No, add as new
              </Button>
            </div>
            <p aria-live="polite" className="text-14 font-semibold text-accent-text empty:hidden">
              {message}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Edit person → "Their account": linked (Unlink), or "Link to account" with
 * one of your connections. If that account is already one of your other
 * people, linking merges that duplicate into this person (said first).
 */
export function AccountSection({
  personId,
  personName,
  linkedProfileId,
  accounts,
  peopleNames,
  onChanged,
}: {
  personId: string;
  personName: string;
  linkedProfileId: string | null;
  accounts: Account[];
  /** Your people's names by id (to name a duplicate). */
  peopleNames: Record<string, string>;
  onChanged: () => void;
}) {
  const [choice, setChoice] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState("");
  const [asked, setAsked] = React.useState<DayMonth | null>(null);
  const selectId = React.useId();
  const linked = accounts.find((a) => a.profileId === linkedProfileId) ?? null;
  const chosen = accounts.find((a) => a.profileId === choice) ?? null;
  const duplicate =
    chosen?.linkedPersonId && chosen.linkedPersonId !== personId
      ? (peopleNames[chosen.linkedPersonId] ?? "Another person")
      : null;

  const link = () =>
    startTransition(async () => {
      if (!chosen) return;
      const result = await linkPersonToAccount({ personId, profileId: chosen.profileId });
      if (!result.ok) return void setMessage(result.message);
      toast.success(
        result.merged
          ? `${result.merged} is merged into ${personName}`
          : `${personName} is linked to ${chosen.firstName}'s account`,
      );
      if (result.theirBirthday) setAsked(result.theirBirthday);
      else onChanged();
    });

  const unlink = () =>
    startTransition(async () => {
      const result = await unlinkPersonFromAccount(personId);
      if (!result.ok) return void setMessage(result.message);
      toast(`${personName} is no longer linked to an account`);
      onChanged();
    });

  return (
    <section aria-labelledby={`${selectId}-title`} className="flex flex-col gap-2.5">
      <h3 id={`${selectId}-title`} className="text-14 font-semibold">
        Their account
      </h3>
      {asked ? (
        <BirthdayQuestion personId={personId} theirs={asked} onDone={onChanged} />
      ) : linkedProfileId ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-14 text-sub">
            Linked to {linked ? `${linked.firstName}'s` : "their"} account. You see their photo and
            wishlist; your name and notes for them stay yours.
          </p>
          <Button variant="card2" onClick={unlink} disabled={pending}>
            Unlink
          </Button>
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-14 text-sub">
          Once someone accepts your invite, you can link them here.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid min-w-0 flex-1 gap-1.5">
              <label htmlFor={selectId} className="text-13 text-sub">
                Link to account
              </label>
              <SelectField
                id={selectId}
                value={choice}
                onChange={(e) => setChoice(e.currentTarget.value)}
              >
                <option value="">Choose a connection</option>
                {accounts.map((a) => (
                  <option key={a.profileId} value={a.profileId}>
                    {a.firstName}
                    {a.linkedPersonId && a.linkedPersonId !== personId
                      ? ` (now ${peopleNames[a.linkedPersonId] ?? "another person"})`
                      : ""}
                  </option>
                ))}
              </SelectField>
            </div>
            <Button variant="card2" onClick={link} disabled={!chosen || pending}>
              <Link2Icon aria-hidden /> Link
            </Button>
          </div>
          {duplicate && (
            <p className="text-13 text-sub">
              {duplicate} is already linked to this account. Linking merges {duplicate} into{" "}
              {personName}: their other days, plans and little things move here, then {duplicate} is
              removed.
            </p>
          )}
        </>
      )}
      <p aria-live="polite" className="text-14 font-semibold text-accent-text empty:hidden">
        {message}
      </p>
    </section>
  );
}
