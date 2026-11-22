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
        <Button variant="card2" onClick={() => openChat({ person, start: "gifts" })}>
          <LightbulbIcon aria-hidden /> Gift ideas
        </Button>
      )}
      {flags.messages && (
        <Button variant="card2" onClick={() => openChat({ person, start: "message" })}>
          <PenLineIcon aria-hidden /> Write a message
        </Button>
      )}
    </div>
  );
}

/** Help & feedback: the Ask Noor box opens the chat with your question. */
export function AskNoorChatBox() {
  const { openChat } = useNoorChat();
  const [question, setQuestion] = React.useState("");
  const id = React.useId();
  const ask = (q: string) => {
    if (q.trim()) openChat({ question: q.trim() });
  };
  return (
    <div id="ask-noor" className="flex w-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <Noor size={44} />
        <div>
          <h2 className="text-22 font-extrabold tracking-[-0.02em]">Ask Noor</h2>
          <p className="text-14 text-sub">I answer from our help articles, in a chat.</p>
        </div>
      </div>
      <div role="group" aria-label="Suggested questions" className="flex flex-wrap gap-2">
        {HELP_CHIPS.map((q) => (
          <Button
            key={q}
            variant="card2"
            onClick={() => ask(q)}
            className="h-auto max-w-full py-2.5 text-left whitespace-normal"
          >
            {q}
          </Button>
        ))}
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <label htmlFor={id} className="text-15 font-semibold">
          Your question
        </label>
        <div className="flex gap-2">
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
        </div>
      </form>
    </div>
  );
}
