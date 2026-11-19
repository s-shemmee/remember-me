"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { formatDayMonth, fromIsoDate } from "@/lib/dates";

import { sealFutureNote, throwAwayFutureNote } from "../actions";
import { MAX_FUTURE_NOTE } from "../countdown";

const dayMonthOf = (iso: string) => {
  const d = fromIsoDate(iso);
  return d ? formatDayMonth(d) : iso;
};

/**
 * "A note to future me" (AppCelebrate, the butter sticky note). Once saved
 * it's sealed: no reading or editing before your birthday (the database
 * checks, in your timezone), only "Throw away and write a new one". On the
 * day, it opens here.
 */
export function FutureNoteCard({
  hasBirthday,
  sealed,
  opened,
  today,
}: {
  hasBirthday: boolean;
  sealed: { opensOn: string } | null;
  /** The newest note you can read (from its day on). */
  opened: { opensOn: string; body: string } | null;
  /** "2026-11-22". */
  today: string;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [state, setState] = React.useState(sealed);
  const [source, setSource] = React.useState(sealed);
  if (source !== sealed) {
    setSource(sealed);
    setState(sealed);
  }
  const fieldId = React.useId();
  const keepRef = React.useRef<HTMLButtonElement>(null);
  const openedToday = opened?.opensOn === today;

  const seal = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await sealFutureNote(body);
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    setState({ opensOn: result.opensOn });
    setBody("");
    setMessage(`Sealed until ${dayMonthOf(result.opensOn)} 💌`);
    router.refresh();
  };

  const throwAway = async () => {
    setBusy(true);
    const result = await throwAwayFutureNote();
    setBusy(false);
    setConfirming(false);
    if (!result.ok) return setMessage(result.message);
    setState(null);
    setMessage("Thrown away, unread. Write a new one whenever you like.");
    router.refresh();
  };

  return (
    <section
      aria-labelledby="future-note"
      className="flex min-w-0 flex-col gap-2.5 rounded-[8px] bg-butter px-6 py-[22px] text-butter-ink shadow-[0_12px_26px_rgba(0,0,0,.10)] motion-reduce:rotate-0 sm:rotate-[1.2deg]"
    >
      <h2 id="future-note" className="text-13 font-bold tracking-[.05em]">
        A NOTE TO FUTURE ME
      </h2>

      {openedToday && opened && (
        <p className="font-hand text-[19px] leading-snug [overflow-wrap:anywhere] whitespace-pre-line">
          {opened.body}
        </p>
      )}

      {!hasBirthday ? (
        <p className="text-14">Add your birthday in your profile, so I know when to open it.</p>
      ) : state ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-14 font-semibold">
            <span aria-hidden>🔒 </span>Sealed until {dayMonthOf(state.opensOn)}. Not even you can
            read it before then.
          </p>
          {confirming ? (
            <div role="group" aria-label="Throw the note away?" className="flex flex-col gap-2">
              <p className="text-14">It goes for good, unread.</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void throwAway()} disabled={busy}>
                  Throw it away
                </Button>
                <Button
                  ref={keepRef}
                  variant="transparent"
                  className="hover:bg-butter-ink/10"
                  onClick={() => setConfirming(false)}
                >
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="transparent"
              className="self-start bg-card/60 hover-tint text-butter-ink"
              onClick={() => {
                setConfirming(true);
                requestAnimationFrame(() => keepRef.current?.focus());
              }}
            >
              Throw away and write a new one
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={seal} className="flex flex-col gap-2.5">
          <label htmlFor={fieldId} className="sr-only">
            Write a note to open on your birthday
          </label>
          <textarea
            id={fieldId}
            rows={5}
            value={body}
            maxLength={MAX_FUTURE_NOTE}
            placeholder="Dear me, this year you…"
            aria-describedby={`${fieldId}-hint`}
            onChange={(e) => setBody(e.target.value)}
            className="w-full resize-none rounded-[6px] border-0 bg-transparent font-hand text-[19px] leading-snug text-butter-ink placeholder:text-butter-ink/70 focus:outline-3 focus:outline-offset-2 focus:outline-accent"
          />
          <p id={`${fieldId}-hint`} className="text-12">
            Once sealed, it opens on your birthday. Only you can read it, and not before.
          </p>
          <Button type="submit" disabled={busy || !body.trim()} className="self-start">
            Seal it until my birthday
          </Button>
        </form>
      )}

      <p role="status" aria-live="polite" className="text-13 font-semibold empty:hidden">
        {message}
      </p>
    </section>
  );
}
