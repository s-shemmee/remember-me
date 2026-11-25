"use client";

import { ArrowUpIcon, RotateCcwIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

import { QUESTION_MAX } from "@/ai/ask-noor/answer";
import { Button } from "@/components/ui/button";
import { Noor } from "@/components/ui/noor";
import { askNoor } from "@/features/ask-noor/actions";
import { InlineText } from "@/features/help/help-content";
import { cn } from "@/lib/utils";

import type { OpenChat } from "./chat-context";
import { HELP_CHIPS, type Item } from "./thread";

const SUBLINE = "Answers from Remember Me help · usually in seconds";

let seq = 0;
const nextId = () => `m${++seq}`;
const noorText = (text: string, extra: Partial<Item> = {}): Item => ({
  id: nextId(),
  from: "noor",
  text,
  ...extra,
});
const mine = (text: string): Item => ({ id: nextId(), from: "me", text });

async function helpAnswer(question: string): Promise<Item> {
  const form = new FormData();
  form.set("question", question);
  const result = await askNoor({ kind: "idle" }, form);
  if (result.kind === "answer") {
    return noorText(result.answer, {
      sources: result.sources.map((source) => ({ url: source.url, title: source.title })),
    });
  }
  if (result.kind === "message") return noorText(result.text, { tone: result.tone });
  return noorText("Something went wrong on my side. Please try again in a moment.", {
    tone: "error",
  });
}

const greeting = () => noorText("Hi! Ask me anything about Remember Me.");

export function NoorChatPanel({
  firstQuestion,
  onClose,
  returnFocus,
}: {
  firstQuestion?: OpenChat["question"];
  onClose: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const ids = React.useId();
  const [thread, setThread] = React.useState<Item[]>(() =>
    firstQuestion ? [greeting(), mine(firstQuestion)] : [greeting()],
  );
  const [pending, setPending] = React.useState(Boolean(firstQuestion));
  const [text, setText] = React.useState("");
  const endRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!firstQuestion) return;
    let live = true;
    void helpAnswer(firstQuestion).then((item) => {
      if (!live) return;
      setThread((items) => [...items, item]);
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
    const value = question.trim();
    if (!value || pending) return;
    setText("");
    setThread((items) => [...items, mine(value)]);
    setPending(true);
    const answer = await helpAnswer(value);
    setThread((items) => [...items, answer]);
    setPending(false);
  };

  const startOver = () => {
    setThread([greeting()]);
    setPending(false);
    setText("");
    inputRef.current?.focus();
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-open:animate-fade-in" />
        <DialogPrimitive.Content
          data-slot="noor-chat"
          aria-describedby={`${ids}-sub`}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            const element = returnFocus();
            if (element?.isConnected) {
              event.preventDefault();
              element.focus();
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
              <Bubble key={item.id} item={item} />
            ))}
            {pending && (
              <div className="flex items-center gap-1 self-start rounded-[22px_22px_22px_6px] bg-bubble px-4 py-3">
                <span className="sr-only">Noor is typing</span>
                {[0, 1, 2].map((delay) => (
                  <span
                    key={delay}
                    aria-hidden
                    className="size-1.5 animate-pulse rounded-full bg-sub motion-reduce:animate-none"
                    style={{ animationDelay: `${delay * 150}ms` }}
                  />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {!pending && (
            <div role="group" aria-label="Suggestions" className="flex flex-wrap gap-1.5 px-4 pb-2">
              {HELP_CHIPS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void ask(question)}
                  className="min-h-11 cursor-pointer rounded-pill bg-card hover-tint px-3.5 text-13 font-semibold shadow-[inset_0_0_0_1.5px_var(--line)] active:bg-accent active:text-on-accent"
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex flex-col gap-1 border-t border-line px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
            onSubmit={(event) => {
              event.preventDefault();
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
                onChange={(event) => setText(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
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

function Bubble({ item }: { item: Item }) {
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
      <p className={cn(item.tone === "error" && "font-semibold text-accent-text")}>
        <InlineText text={item.text} />
      </p>
      {item.sources?.map((source) => (
        <Link
          key={source.url}
          href={source.url}
          className="inline-flex min-h-11 items-center text-14 font-semibold text-accent-text underline-offset-4 hover:underline"
        >
          From: {source.title} →
        </Link>
      ))}
    </div>
  );
}
