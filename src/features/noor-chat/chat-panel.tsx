"use client";

import { ArrowUpIcon, CheckIcon, CopyIcon, PlusIcon, RotateCcwIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

import { QUESTION_MAX } from "@/ai/ask-noor/answer";
import type { Language, Tone } from "@/ai/messages/prompt";
import { Button } from "@/components/ui/button";
import { Noor } from "@/components/ui/noor";
import { askNoor } from "@/features/ask-noor/actions";
import { addGiftIdeaToPlan, newGiftIdeas } from "@/features/gift-ideas/actions";
import { BUDGET_LABELS, type BudgetChoice } from "@/features/gift-ideas/schema";
import { InlineText } from "@/features/help/help-content";
import { draftNoorMessages, saveMessageInPlan } from "@/features/messages/actions";
import { LANGUAGE_LABELS, TONE_LABELS } from "@/features/messages/schema";
import { suggestEmoji } from "@/features/people/little-emoji";
import type { Pastel } from "@/styles/tokens";
import { pastelClasses } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

import type { ChatFlags, ChatPerson } from "./chat-context";
import { HELP_CHIPS, type Item, type Step } from "./thread";

const SUBLINE = "Answers from Remember Me help · usually in seconds";

let seq = 0;
const nextId = () => `m${++seq}`;
const noorText = (text: string, extra: Partial<Extract<Item, { kind: "text" }>> = {}): Item => ({
  id: nextId(),
  from: "noor",
  kind: "text",
  text,
  ...extra,
});
const mine = (text: string): Item => ({ id: nextId(), from: "me", kind: "text", text });

/** One help answer from the existing Ask Noor flow (the same checks and limits). */
async function helpAnswer(question: string): Promise<Item> {
  const form = new FormData();
  form.set("question", question);
  const r = await askNoor({ kind: "idle" }, form);
  if (r.kind === "answer") {
    return noorText(r.answer, {
      sources: r.sources.map((s) => ({ url: s.url, title: s.title })),
    });
  }
  if (r.kind === "message") return noorText(r.text, { tone: r.tone });
  return noorText("Something went wrong on my side. Please try again in a moment.", {
    tone: "error",
  });
}

function opening(
  person: ChatPerson | null,
  start?: "gifts" | "message",
): {
  thread: Item[];
  step: Step;
} {
  if (person && start === "gifts") {
    return {
      thread: [noorText(`Let's find something for ${person.name}. What kind of budget?`)],
      step: { kind: "budget" },
    };
  }
  if (person && start === "message") {
    return {
      thread: [noorText(`Let's write to ${person.name}. Which tone?`)],
      step: { kind: "tone" },
    };
  }
  return {
    thread: [
      noorText(
        person
          ? `Hi! Ask me about Remember Me, or let's do something for ${person.name}.`
          : "Hi! Ask me anything about Remember Me.",
      ),
    ],
    step: { kind: "idle" },
  };
}

/**
 * Noor's chat panel (docs/roadmap/02-noor-chat.md). iMessage-style: Noor
 * left, you right. Help answers come from the existing Ask Noor flow (with
 * their sources); on a person's page, gift ideas and message drafts use the
 * existing gift-ideas and noor-messages flows and their daily limits.
 * Nothing is stored: closing (or Start over) clears it.
 */
export function NoorChatPanel({
  flags,
  person,
  firstQuestion,
  start,
  onClose,
  returnFocus,
}: {
  flags: ChatFlags;
  person: ChatPerson | null;
  firstQuestion?: string;
  start?: "gifts" | "message";
  onClose: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const router = useRouter();
  const ids = React.useId();
  const [first] = React.useState(() => opening(person, start));
  const [thread, setThread] = React.useState<Item[]>(() =>
    firstQuestion ? [...first.thread, mine(firstQuestion)] : first.thread,
  );
  const [step, setStep] = React.useState<Step>(first.step);
  const [pending, setPending] = React.useState(Boolean(firstQuestion));
  const [text, setText] = React.useState("");
  const [done, setDone] = React.useState<Record<string, "added" | "copied">>({});
  const endRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const add = (...items: Item[]) => setThread((t) => [...t, ...items]);

  // A question from the launcher (Help & feedback) is asked at once.
  React.useEffect(() => {
    if (!firstQuestion) return;
    let live = true;
    void helpAnswer(firstQuestion).then((item) => {
      if (!live) return;
      setThread((t) => [...t, item]);
      setPending(false);
    });
    return () => {
      live = false;
    };
  }, [firstQuestion]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread, pending]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || pending) return;
    setText("");
    add(mine(q));
    setPending(true);
    add(await helpAnswer(q));
    setPending(false);
  };

  const pickBudget = async (budget: BudgetChoice | null) => {
    if (!person) return;
    setStep({ kind: "idle" });
    add(mine(budget ? BUDGET_LABELS[budget] : "Any budget"));
    setPending(true);
    const r = await newGiftIdeas({ personId: person.personId, budget });
    setPending(false);
    if (r.kind === "ideas") {
      add(noorText(`Here are some ideas for ${person.name}:`), {
        id: nextId(),
        from: "noor",
        kind: "ideas",
        ideas: r.ideas,
      });
    } else {
      add(noorText(r.text, { tone: r.tone }));
    }
  };

  const pickTone = (tone: Tone) => {
    add(mine(TONE_LABELS[tone]), noorText("And which language?"));
    setStep({ kind: "language", tone });
  };

  const pickLanguage = async (tone: Tone, language: Language) => {
    if (!person) return;
    setStep({ kind: "idle" });
    add(mine(LANGUAGE_LABELS[language]));
    setPending(true);
    const r = await draftNoorMessages({
      occasionId: person.occasionId,
      tone,
      language,
      length: "short",
    });
    setPending(false);
    if (r.kind === "messages") {
      add(noorText(`Here are 3 drafts for ${person.name}:`), {
        id: nextId(),
        from: "noor",
        kind: "drafts",
        drafts: r.messages,
      });
    } else {
      add(noorText(r.text, { tone: r.tone }));
    }
  };

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setDone((d) => ({ ...d, [key]: "copied" }));
    } catch {
      add(noorText("I couldn't copy it. Select the text and copy it.", { tone: "error" }));
    }
  };

  const addIdea = async (key: string, title: string) => {
    if (!person) return;
    const r = await addGiftIdeaToPlan({
      occasionId: person.occasionId,
      occursOn: person.occursOn,
      title,
    });
    if (!r.ok) return add(noorText(r.message, { tone: "error" }));
    setDone((d) => ({ ...d, [key]: "added" }));
    router.refresh();
  };

  const saveDraft = async (key: string, draft: string) => {
    if (!person) return;
    const r = await saveMessageInPlan({
      occasionId: person.occasionId,
      occursOn: person.occursOn,
      stepId: null,
      text: draft,
    });
    if (!r.ok) return add(noorText(r.message, { tone: "error" }));
    setDone((d) => ({ ...d, [key]: "added" }));
    router.refresh();
  };

  const startOver = () => {
    const fresh = opening(person);
    setThread(fresh.thread);
    setStep(fresh.step);
    setDone({});
    setText("");
    inputRef.current?.focus();
  };

  // What Noor offers next, as chips above the input.
  const chips: { label: string; onPick: () => void }[] =
    step.kind === "budget"
      ? [
          ...(Object.keys(BUDGET_LABELS) as BudgetChoice[]).map((b) => ({
            label: BUDGET_LABELS[b],
            onPick: () => void pickBudget(b),
          })),
          { label: "Any budget", onPick: () => void pickBudget(null) },
        ]
      : step.kind === "tone"
        ? (Object.keys(TONE_LABELS) as Tone[]).map((t) => ({
            label: TONE_LABELS[t],
            onPick: () => pickTone(t),
          }))
        : step.kind === "language"
          ? (Object.keys(LANGUAGE_LABELS) as Language[]).map((l) => ({
              label: LANGUAGE_LABELS[l],
              onPick: () => void pickLanguage(step.tone, l),
            }))
          : person
            ? [
                ...(flags.gifts
                  ? [
                      {
                        label: `Gift ideas for ${person.name}`,
                        onPick: () => {
                          add(
                            mine(`Gift ideas for ${person.name}`),
                            noorText("What kind of budget?"),
                          );
                          setStep({ kind: "budget" });
                        },
                      },
                    ]
                  : []),
                ...(flags.messages
                  ? [
                      {
                        label: `Write ${person.name} a message`,
                        onPick: () => {
                          add(mine(`Write ${person.name} a message`), noorText("Which tone?"));
                          setStep({ kind: "tone" });
                        },
                      },
                    ]
                  : []),
              ]
            : HELP_CHIPS.map((q) => ({ label: q, onPick: () => void ask(q) }));

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-open:animate-fade-in" />
        <DialogPrimitive.Content
          data-slot="noor-chat"
          aria-describedby={`${ids}-sub`}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            const el = returnFocus();
            if (el?.isConnected) {
              e.preventDefault();
              el.focus();
            }
          }}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-card text-text shadow-card outline-none data-open:animate-up",
            "inset-x-0 bottom-0 h-[88dvh] rounded-t-[28px]",
            "sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[min(620px,calc(100dvh-48px))] sm:w-[400px] sm:rounded-[28px]",
          )}
        >
          <header className="flex items-center gap-3 bg-[linear-gradient(160deg,var(--peach),var(--peach2))] px-4 py-3">
            <Noor size={36} mood="smiling" className="shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col">
              <DialogPrimitive.Title className="text-16 font-bold">Noor</DialogPrimitive.Title>
              <DialogPrimitive.Description id={`${ids}-sub`} className="text-12 text-sub">
                {pending ? "typing…" : SUBLINE}
              </DialogPrimitive.Description>
            </div>
            <Button variant="transparent" size="icon" onClick={startOver}>
              <RotateCcwIcon aria-hidden className="size-[18px]" />
              <span className="sr-only">Start over</span>
            </Button>
            <DialogPrimitive.Close asChild>
              <Button variant="transparent" size="icon">
                <XIcon aria-hidden />
                <span className="sr-only">Close</span>
              </Button>
            </DialogPrimitive.Close>
          </header>

          <div
            role="log"
            aria-live="polite"
            aria-label="Conversation with Noor"
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4"
          >
            {thread.map((item) => (
              <Bubble key={item.id} item={item}>
                {item.kind === "ideas" && (
                  <ul className="flex flex-col gap-2">
                    {item.ideas.map((idea, i) => {
                      const key = `${item.id}-${i}`;
                      return (
                        <li
                          key={key}
                          className={cn(
                            "flex flex-col gap-1.5 rounded-[16px] p-3",
                            pastelClasses[IDEA_PASTELS[i % IDEA_PASTELS.length]!],
                          )}
                        >
                          <span aria-hidden="true" className="text-[24px] leading-none">
                            {suggestEmoji(idea.title) ?? "🎁"}
                          </span>
                          <span className="text-15 font-bold">{idea.title}</span>
                          <span className="text-13">{idea.why}</span>
                          <div className="flex flex-wrap gap-1.5">
                            <ChatAction
                              primary
                              label={done[key] === "added" ? "In the plan" : "Add to plan"}
                              name={idea.title}
                              done={done[key] === "added"}
                              icon={<PlusIcon aria-hidden />}
                              onClick={() => void addIdea(key, idea.title)}
                            />
                            <ChatAction
                              label={done[`${key}-c`] === "copied" ? "Copied" : "Copy"}
                              name={idea.title}
                              done={false}
                              icon={<CopyIcon aria-hidden />}
                              onClick={() => void copy(`${key}-c`, `${idea.title}: ${idea.why}`)}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {item.kind === "drafts" && (
                  <ul className="flex flex-col gap-2">
                    {item.drafts.map((draft, i) => {
                      const key = `${item.id}-${i}`;
                      return (
                        <li key={key} className="flex flex-col gap-1.5 rounded-[16px] bg-card p-3">
                          <span dir="auto" className="text-14 [overflow-wrap:anywhere]">
                            {draft}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            <ChatAction
                              on="card"
                              label={done[key] === "added" ? "In the plan" : "Use in plan"}
                              name={`draft ${i + 1}`}
                              done={done[key] === "added"}
                              icon={<PlusIcon aria-hidden />}
                              onClick={() => void saveDraft(key, draft)}
                            />
                            <ChatAction
                              on="card"
                              label={done[`${key}-c`] === "copied" ? "Copied" : "Copy"}
                              name={`draft ${i + 1}`}
                              done={false}
                              icon={<CopyIcon aria-hidden />}
                              onClick={() => void copy(`${key}-c`, draft)}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Bubble>
            ))}
            {pending && (
              <div className="flex items-center gap-1 self-start rounded-[22px_22px_22px_6px] bg-bubble px-4 py-3">
                <span className="sr-only">Noor is typing</span>
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    aria-hidden
                    className="size-1.5 animate-pulse rounded-full bg-sub motion-reduce:animate-none"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {chips.length > 0 && !pending && (
            <div role="group" aria-label="Suggestions" className="flex flex-wrap gap-1.5 px-4 pb-2">
              {chips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={c.onPick}
                  className="min-h-11 cursor-pointer rounded-pill bg-card hover-tint px-3.5 text-13 font-semibold shadow-[inset_0_0_0_1.5px_var(--line)] active:bg-accent active:text-on-accent"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex flex-col gap-1 border-t border-line px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(text);
            }}
          >
            <div className="flex items-end gap-2">
              <label htmlFor={`${ids}-input`} className="sr-only">
                Ask Noor
              </label>
              <textarea
                ref={inputRef}
                id={`${ids}-input`}
                rows={1}
                maxLength={QUESTION_MAX}
                value={text}
                placeholder="Ask about Remember Me…"
                aria-describedby={`${ids}-count ${ids}-note`}
                onChange={(e) => setText(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask(text);
                  }
                }}
                className="max-h-28 min-h-11 flex-1 resize-none rounded-[22px] border-[1.5px] border-line bg-card px-4 py-2.5 text-15 placeholder:text-sub focus:border-accent focus:outline-none"
              />
              <Button type="submit" size="icon" disabled={pending || !text.trim()}>
                <ArrowUpIcon aria-hidden />
                <span className="sr-only">Send</span>
              </Button>
            </div>
            <div className="flex justify-between gap-3 text-12 text-sub">
              <span id={`${ids}-note`}>Not saved. Closing clears the chat.</span>
              <span id={`${ids}-count`}>
                {text.length}/{QUESTION_MAX}
              </span>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Bubble({ item, children }: { item: Item; children?: React.ReactNode }) {
  if (item.from === "me") {
    return (
      <p className="max-w-[85%] self-end rounded-[22px_22px_6px_22px] bg-accent px-4 py-2.5 text-15 [overflow-wrap:anywhere] text-on-accent">
        <span className="sr-only">You: </span>
        {item.text}
      </p>
    );
  }
  return (
    <div className="flex max-w-[92%] flex-col gap-2 self-start rounded-[22px_22px_22px_6px] bg-bubble px-4 py-2.5 text-15">
      <span className="sr-only">Noor: </span>
      {item.kind === "text" && (
        <p className={cn(item.tone === "error" && "font-semibold text-accent-text")}>
          <InlineText text={item.text} />
        </p>
      )}
      {item.kind === "text" &&
        item.sources?.map((s) => (
          <Link
            key={s.url}
            href={s.url}
            className="inline-flex min-h-11 items-center text-14 font-semibold text-accent-text underline-offset-4 hover:underline"
          >
            From: {s.title} →
          </Link>
        ))}
      {children}
    </div>
  );
}

/** Gift idea cards cycle through these pastels (text in the pastel's ink). */
const IDEA_PASTELS: Pastel[] = ["peach", "mint", "sky", "lilac", "butter"];

/** "Add to plan" is the accent pill on a gift idea; the rest are `card` pills. */
function ChatAction({
  label,
  name,
  done,
  icon,
  onClick,
  primary = false,
  on = "pastel",
}: {
  label: string;
  name: string;
  done: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  /** The surface it sits on: a pastel idea card (default) or a white draft card. */
  on?: "pastel" | "card";
}) {
  return (
    <Button
      variant={primary ? "accent" : on === "card" ? "card2" : "card"}
      disabled={done}
      onClick={onClick}
      aria-label={`${label}: ${name}`}
      className="min-h-11 px-3.5 text-13"
    >
      {done ? <CheckIcon aria-hidden /> : icon}
      {label}
    </Button>
  );
}
