"use client";

import { LightbulbIcon, MessageCircleIcon, PenLineIcon } from "lucide-react";
import * as React from "react";

import { QUESTION_MAX } from "@/ai/ask-noor/answer";
import { Button } from "@/components/ui/button";
import { Noor } from "@/components/ui/noor";
import { cn } from "@/lib/utils";

import { type ChatPerson, useNoorChat } from "./chat-context";
import { HELP_CHIPS } from "./thread";

/** Home's nudge card: "Ask Noor" opens the chat (help questions). */
export function AskNoorButton({ className }: { className?: string }) {
  const { flags, openChat } = useNoorChat();
  if (!flags.enabled) return null;
  return (
    <Button variant="card2" className={cn("bg-card", className)} onClick={() => openChat()}>
      <MessageCircleIcon aria-hidden /> Ask Noor
    </Button>
  );
}

/**
 * A person's page: "Gift ideas" and "Write a message" open the chat with
 * that person's context. Null when the chat is off (the old dialogs stay).
 */
export function PersonChatButtons({ person }: { person: ChatPerson }) {
  const { flags, openChat } = useNoorChat();
  if (!flags.enabled || (!flags.gifts && !flags.messages)) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {flags.gifts && (
        <Button variant="card" onClick={() => openChat({ person, start: "gifts" })}>
          <LightbulbIcon aria-hidden /> Gift ideas
        </Button>
      )}
      {flags.messages && (
        <Button variant="card" onClick={() => openChat({ person, start: "message" })}>
          <PenLineIcon aria-hidden /> Write a message
        </Button>
      )}
    </div>
  );
}

/**
 * Help & feedback: the Ask Noor card (peach, on the page's section). Asking,
 * or a popular question, opens the chat with it.
 */
export function AskNoorChatBox() {
  const { openChat } = useNoorChat();
  const [question, setQuestion] = React.useState("");
  const id = React.useId();
  const ask = (q: string) => {
    if (q.trim()) openChat({ question: q.trim() });
  };
  return (
    <div id="ask-noor" className="flex w-full min-w-0 gap-4 sm:gap-5">
      <Noor size={56} animated className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-22 font-extrabold tracking-[-0.02em]">Ask Noor</h2>
          <label htmlFor={id} className="text-15 text-sub">
            Ask me anything about Remember Me.
          </label>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <input
            id={id}
            value={question}
            maxLength={QUESTION_MAX}
            onChange={(e) => setQuestion(e.currentTarget.value)}
            placeholder="How do reminders work?"
            className="min-h-11 min-w-0 flex-1 rounded-pill border-[1.5px] border-line bg-card px-4 text-15 placeholder:text-sub focus:border-accent focus:outline-none"
          />
          <Button type="submit" disabled={!question.trim()}>
            Ask
          </Button>
        </form>
        <div role="group" aria-label="Popular questions" className="flex flex-wrap gap-2">
          {HELP_CHIPS.map((q) => (
            <Button
              key={q}
              variant="card"
              onClick={() => ask(q)}
              className="h-auto max-w-full py-2.5 text-left text-14 whitespace-normal"
            >
              {q}
            </Button>
          ))}
        </div>
        <p className="text-13 text-sub">Asking opens the Noor chat.</p>
      </div>
    </div>
  );
}
