"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePlans } from "@/features/plans/components/plan-state";
import { cn } from "@/lib/utils";

import { addGiftIdeaToPlan, newGiftIdeas, savedGiftIdeas } from "../actions";
import { BUDGET_LABELS, type BudgetChoice, type GiftIdeasState } from "../schema";

/** Who the ideas are for, and the day "Add to their plan" adds to. */
export type GiftIdeasTarget = {
  personId: string;
  name: string;
  occasionId: string;
  occursOn: string;
};

const BUDGET_CHOICES = Object.keys(BUDGET_LABELS) as BudgetChoice[];

/**
 * "Ask Noor for gift ideas 💡" (a person's panel, and Home's nudge for the
 * next birthday). Only rendered for days that aren't gentle and people who
 * aren't "In memory"; the server checks that again.
 */
export function GiftIdeasButton({
  target,
  className,
}: {
  target: GiftIdeasTarget;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const opener = React.useRef<HTMLElement | null>(null);
  return (
    <>
      <Button
        variant="card2"
        onClick={() => setOpen(true)}
        className={cn("h-auto max-w-full py-2.5 whitespace-normal", className)}
      >
        Ask Noor for gift ideas <span aria-hidden>💡</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-lg"
          onOpenAutoFocus={() => {
            opener.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(event) => {
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
        >
          {open && <GiftIdeasBody target={target} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

type Status = { tone: "info" | "error"; text: string } | null;

function madeWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function GiftIdeasBody({ target }: { target: GiftIdeasTarget }) {
  const { setPlan } = usePlans();
  const ids = React.useId();
  const [ideas, setIdeas] = React.useState<Extract<GiftIdeasState, { kind: "ideas" }> | null>(null);
  const [budget, setBudget] = React.useState<BudgetChoice | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [thinking, setThinking] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Status>(null);

  // The last ideas are saved: reopening costs nothing.
  React.useEffect(() => {
    let live = true;
    void savedGiftIdeas({ personId: target.personId }).then((saved) => {
      if (!live) return;
      if (saved?.kind === "ideas") {
        setIdeas(saved);
        setBudget(saved.budget);
      }
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [target.personId]);

  const ask = async () => {
    setThinking(true);
    setStatus({ tone: "info", text: "Thinking of ideas…" });
    const result = await newGiftIdeas({ personId: target.personId, budget });
    setThinking(false);
    if (result.kind === "ideas") {
      setIdeas(result);
      setAdded(null);
      setStatus({
        tone: "info",
        text: `Here are ${result.ideas.length} ideas for ${target.name}.`,
      });
    } else {
      setStatus({ tone: result.tone, text: result.text });
    }
  };

  const add = async (title: string) => {
    setBusy(title);
    const result = await addGiftIdeaToPlan({
      occasionId: target.occasionId,
      occursOn: target.occursOn,
      title,
    });
    setBusy(null);
    if (result.ok) {
      setPlan(result.plan);
      setAdded(title);
      setStatus({ tone: "info", text: `Added "${title}" to their plan.` });
    } else {
      setStatus({ tone: "error", text: result.message });
    }
  };

  const copy = async (title: string, why: string) => {
    try {
      await navigator.clipboard.writeText(`${title}: ${why}`);
      setStatus({ tone: "info", text: "Copied." });
    } catch {
      setStatus({ tone: "error", text: "I couldn't copy that. Please select the text instead." });
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Gift ideas for {target.name}</DialogTitle>
        <DialogDescription>
          From the little things they love and their free wishes. Only their first name and those
          are shared with Noor.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <p id={`${ids}-budget`} className="text-13 font-semibold text-sub">
          Budget (optional)
        </p>
        <div role="group" aria-labelledby={`${ids}-budget`} className="flex flex-wrap gap-2">
          {BUDGET_CHOICES.map((b) => (
            <Button
              key={b}
              type="button"
              variant="card2"
              aria-pressed={budget === b}
              disabled={thinking}
              onClick={() => setBudget((current) => (current === b ? null : b))}
              className="px-4 text-14 aria-pressed:bg-text aria-pressed:text-bg"
            >
              {BUDGET_LABELS[b]}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-14 text-sub">One moment…</p>
      ) : ideas ? (
        <section aria-labelledby={`${ids}-ideas`} className="flex flex-col gap-2">
          <h3 id={`${ids}-ideas`} className="sr-only">
            Ideas
          </h3>
          <ul className="flex flex-col gap-2">
            {ideas.ideas.map((idea) => (
              <li
                key={idea.title}
                className="flex flex-col gap-2 rounded-[16px] bg-card2 px-3.5 py-3"
              >
                <span className="text-15 font-bold [overflow-wrap:anywhere]">{idea.title}</span>
                <span className="text-14 [overflow-wrap:anywhere] text-sub">{idea.why}</span>
                <span className="flex flex-wrap gap-2">
                  <Button
                    variant="transparent"
                    disabled={busy !== null}
                    onClick={() => void add(idea.title)}
                    className="h-auto max-w-full bg-card py-2.5 text-14 whitespace-normal"
                  >
                    {added === idea.title ? (
                      <>
                        Added to their plan <span aria-hidden>✓</span>
                      </>
                    ) : (
                      "Add to their plan"
                    )}
                  </Button>
                  <Button
                    variant="transparent"
                    onClick={() => void copy(idea.title, idea.why)}
                    aria-label={`Copy: ${idea.title}`}
                    className="text-14"
                  >
                    Copy
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-13 text-sub">Made {madeWhen(ideas.createdAt)}.</p>
        </section>
      ) : (
        <p className="text-14 text-sub">
          I&apos;ll suggest a few ideas based on what {target.name} loves.
        </p>
      )}

      <p
        aria-live="polite"
        className={cn(
          "min-h-5 text-14",
          status?.tone === "error" ? "font-semibold text-accent-text" : "text-sub",
        )}
      >
        {status?.text}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={ideas ? "card2" : "accent"}
          disabled={loading || thinking}
          onClick={() => void ask()}
        >
          {thinking ? "Thinking…" : ideas ? "New ideas" : "Show me ideas"}
        </Button>
      </div>
      {ideas && <p className="text-13 text-sub">New ideas use one of your 5 for today.</p>}
    </>
  );
}
