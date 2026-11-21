"use client";

import { CheckIcon, CopyIcon, PenLineIcon } from "lucide-react";
import * as React from "react";

import type { Language, Length, Tone } from "@/ai/messages/prompt";
import { LANGUAGES, LENGTHS, MENTION_MAX, MESSAGE_MAX, TONES } from "@/ai/messages/prompt";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, ChoiceItem } from "@/components/ui/choice-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { usePlans } from "@/features/plans/components/plan-state";
import { cn } from "@/lib/utils";

import { draftNoorMessages, messageContext, saveMessageInPlan } from "../actions";
import { LANGUAGE_LABELS, LENGTH_LABELS, type MessageContext, TONE_LABELS } from "../schema";

/** Who it's for, the day, and (from a plan) the step "Use in plan" fills. */
export type MessageTarget = {
  name: string;
  occasionId: string;
  occursOn: string;
  stepId?: string | null;
};

const chip =
  "inline-flex min-h-11 items-center rounded-pill bg-card2 px-4 text-14 font-semibold text-text data-[state=checked]:bg-text data-[state=checked]:text-bg";

/**
 * "Write a message" (a person's page) or "Write with Noor" (the Message step
 * of a plan): Noor drafts 3 messages in the tone, language and length you
 * pick. Each can be edited, copied, or used in the plan (saved on its
 * Message step, which is ticked). Only rendered when AI_MESSAGES_ENABLED.
 */
export function WriteMessageButton({
  target,
  label = "Write a message",
  className,
  variant = "card2",
}: {
  target: MessageTarget;
  label?: string;
  className?: string;
  variant?: "card2" | "transparent";
}) {
  const [open, setOpen] = React.useState(false);
  const opener = React.useRef<HTMLElement | null>(null);
  return (
    <>
      <Button
        variant={variant}
        onClick={() => setOpen(true)}
        className={cn("h-auto max-w-full py-2.5 whitespace-normal", className)}
      >
        <PenLineIcon aria-hidden /> {label}
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
          {open && <MessageBody target={target} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

type Status = { tone: "info" | "error"; text: string } | null;

function MessageBody({ target, onDone }: { target: MessageTarget; onDone: () => void }) {
  const { setPlan } = usePlans();
  const ids = React.useId();
  const [tone, setTone] = React.useState<Tone>("warm");
  const [language, setLanguage] = React.useState<Language>("en");
  const [length, setLength] = React.useState<Length>("short");
  const [mention, setMention] = React.useState("");
  const [context, setContext] = React.useState<MessageContext | null>(null);
  const [things, setThings] = React.useState<string[]>([]);
  const [includeAge, setIncludeAge] = React.useState(false);

  // Their little things (and age, if known) to choose from: no AI call.
  React.useEffect(() => {
    let live = true;
    void messageContext({ occasionId: target.occasionId }).then((c) => {
      if (!live || !c) return;
      setContext(c);
      setThings(c.littleThings.map((t) => t.text));
    });
    return () => {
      live = false;
    };
  }, [target.occasionId]);
  const [drafts, setDrafts] = React.useState<string[] | null>(null);
  const [thinking, setThinking] = React.useState(false);
  const [busy, setBusy] = React.useState<number | null>(null);
  const [copied, setCopied] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<Status>(null);
  const first = React.useRef<HTMLTextAreaElement>(null);

  const write = async () => {
    setThinking(true);
    setStatus({ tone: "info", text: "Finding the words…" });
    const result = await draftNoorMessages({
      occasionId: target.occasionId,
      tone,
      language,
      length,
      mention,
      includeAge,
      // Only the ones still chosen (null until the list has loaded: all of them).
      things: context ? things : null,
    });
    setThinking(false);
    if (result.kind === "messages") {
      setDrafts(result.messages);
      setCopied(null);
      setStatus({ tone: "info", text: `Here are 3 drafts for ${target.name}. Edit any of them.` });
      requestAnimationFrame(() => first.current?.focus());
    } else {
      setStatus({ tone: result.tone, text: result.text });
    }
  };

  const copy = async (i: number) => {
    try {
      await navigator.clipboard.writeText(drafts![i]!);
      setCopied(i);
      setStatus({ tone: "info", text: "Copied." });
    } catch {
      setStatus({ tone: "error", text: "I couldn't copy it. Select the text and copy it." });
    }
  };

  const use = async (i: number) => {
    setBusy(i);
    const result = await saveMessageInPlan({
      occasionId: target.occasionId,
      occursOn: target.occursOn,
      stepId: target.stepId ?? null,
      text: drafts![i]!,
    });
    setBusy(null);
    if (!result.ok) return setStatus({ tone: "error", text: result.message });
    setPlan(result.plan);
    setStatus({ tone: "info", text: `Saved in ${target.name}'s plan, and ticked.` });
    onDone();
  };

  const group = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: readonly string[],
    labels: Record<string, string>,
  ) => {
    const id = `${ids}-${label}`;
    return (
      <div className="flex flex-col gap-2">
        <span id={id} className="text-14 font-semibold">
          {label}
        </span>
        <ChoiceGroup aria-labelledby={id} value={value} onValueChange={onChange}>
          {options.map((o) => (
            <ChoiceItem key={o} value={o} className={chip}>
              {labels[o]}
            </ChoiceItem>
          ))}
        </ChoiceGroup>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle className="[overflow-wrap:anywhere]">A message for {target.name}</DialogTitle>
        <DialogDescription>
          I draft 3 from what you&apos;ve told me about them. Edit before you use one.
        </DialogDescription>
      </DialogHeader>

      {group("Tone", tone, (v) => setTone(v as Tone), TONES, TONE_LABELS)}
      {group("Language", language, (v) => setLanguage(v as Language), LANGUAGES, LANGUAGE_LABELS)}
      {group("Length", length, (v) => setLength(v as Length), LENGTHS, LENGTH_LABELS)}

      {context && context.littleThings.length > 0 && (
        <div className="flex flex-col gap-2">
          <span id={`${ids}-things`} className="text-14 font-semibold">
            Little things to use
          </span>
          <div role="group" aria-labelledby={`${ids}-things`} className="flex flex-wrap gap-1.5">
            {context.littleThings.map((t) => {
              const on = things.includes(t.text);
              return (
                <button
                  key={t.text}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setThings((all) => (on ? all.filter((x) => x !== t.text) : [...all, t.text]))
                  }
                  className="inline-flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-pill bg-card2 hover-tint px-3.5 text-14 font-semibold text-text aria-pressed:bg-text aria-pressed:text-bg"
                >
                  <span aria-hidden>{t.emoji}</span>
                  <span className="[overflow-wrap:anywhere]">{t.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {context?.age && (
        <div className="flex items-center justify-between gap-4 rounded-[16px] bg-card2 px-4 py-3">
          <label htmlFor={`${ids}-age`} className="text-15 font-semibold">
            Mention that they turn {context.age}
          </label>
          <Switch id={`${ids}-age`} checked={includeAge} onCheckedChange={setIncludeAge} />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${ids}-mention`} className="text-14 font-semibold">
          Something to mention (optional)
        </label>
        <textarea
          id={`${ids}-mention`}
          rows={2}
          maxLength={MENTION_MAX}
          value={mention}
          onChange={(e) => setMention(e.currentTarget.value)}
          aria-describedby={`${ids}-mention-count`}
          placeholder="e.g. our trip to Essaouira"
          className="min-h-11 w-full resize-y rounded-[16px] border-[1.5px] border-line bg-card px-4 py-3 text-15 text-text placeholder:text-sub focus:border-accent focus:outline-none"
        />
        <span id={`${ids}-mention-count`} className="text-13 text-sub">
          {mention.length}/{MENTION_MAX} characters
        </span>
      </div>

      <Button onClick={() => void write()} disabled={thinking} className="self-start">
        {thinking ? "Writing…" : drafts ? "New drafts" : "Write with Noor"}
      </Button>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "text-14 empty:hidden",
          status?.tone === "error" ? "font-semibold text-accent-text" : "text-sub",
        )}
      >
        {status?.text ?? ""}
      </p>

      {drafts && (
        <ol aria-label="Drafts" className="flex flex-col gap-3">
          {drafts.map((d, i) => {
            const fieldId = `${ids}-draft-${i}`;
            return (
              <li key={i} className="flex flex-col gap-2 rounded-[20px] bg-card2 p-3.5">
                <label htmlFor={fieldId} className="text-13 font-semibold text-sub">
                  Draft {i + 1}
                </label>
                <textarea
                  ref={i === 0 ? first : undefined}
                  id={fieldId}
                  rows={3}
                  maxLength={MESSAGE_MAX}
                  value={d}
                  dir="auto"
                  onChange={(e) => {
                    const text = e.currentTarget.value;
                    setDrafts((all) => all!.map((x, j) => (j === i ? text : x)));
                  }}
                  className="w-full resize-y rounded-[14px] border-[1.5px] border-line bg-card px-3.5 py-2.5 text-15 text-text focus:border-accent focus:outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="card2"
                    className="bg-card"
                    onClick={() => void copy(i)}
                    aria-label={`${copied === i ? "Copied" : "Copy"}: draft ${i + 1}`}
                  >
                    {copied === i ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
                    {copied === i ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    onClick={() => void use(i)}
                    disabled={busy !== null || !d.trim()}
                    aria-label={busy === i ? undefined : `Use in plan: draft ${i + 1}`}
                  >
                    {busy === i ? "Saving…" : "Use in plan"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
