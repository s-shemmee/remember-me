"use client";

import Link from "next/link";
import * as React from "react";
import { useActionState } from "react";

import { QUESTION_MAX } from "@/ai/ask-noor/answer";
import { Button } from "@/components/ui/button";
import { Noor } from "@/components/ui/noor";
import { InlineText } from "@/features/help/help-content";

import { askNoor } from "../actions";
import { type AskNoorState, SUGGESTIONS } from "../schema";

/**
 * Ask Noor (Help & feedback): one question at a time, no chat
 * memory. Three suggested questions, a 300-character field with a live count,
 * and the answer (with links to its sources) in a polite live region.
 */
export function AskNoorCard() {
  const [state, action, pending] = useActionState<AskNoorState, FormData>(askNoor, {
    kind: "idle",
  });
  const [question, setQuestion] = React.useState("");
  const formRef = React.useRef<HTMLFormElement>(null);

  const ask = (text: string) => {
    setQuestion(text);
    // Let the field update, then submit as if typed.
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  };

  return (
    <div id="ask-noor" className="flex w-full scroll-mt-24 flex-col gap-4">
      <div className="flex items-center gap-3">
        <Noor size={44} />
        <div>
          <h2 className="text-22 font-extrabold tracking-[-0.02em]">Ask Noor</h2>
          <p className="text-14 text-sub">
            I answer from our help articles. One question at a time.
          </p>
        </div>
      </div>

      <div role="group" aria-label="Suggested questions" className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <Button
            key={s}
            type="button"
            variant="card2"
            disabled={pending}
            onClick={() => ask(s)}
            className="h-auto max-w-full py-2.5 text-left whitespace-normal"
          >
            {s}
          </Button>
        ))}
      </div>

      <form ref={formRef} action={action} className="flex flex-col gap-2">
        <label htmlFor="ask-noor-question" className="text-15 font-semibold">
          Your question
        </label>
        <textarea
          id="ask-noor-question"
          name="question"
          rows={2}
          required
          maxLength={QUESTION_MAX}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          aria-describedby={
            state.kind === "message" && state.tone === "error"
              ? "ask-noor-count ask-noor-reply"
              : "ask-noor-count"
          }
          aria-invalid={
            state.kind === "message" && state.tone === "error" && !state.question ? true : undefined
          }
          placeholder="How do reminders work?"
          className="min-h-11 w-full resize-y rounded-[16px] border-[1.5px] border-line bg-card px-4 py-3 text-15 text-text placeholder:text-sub focus:border-accent focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span id="ask-noor-count" className="text-13 text-sub">
            {question.length}/{QUESTION_MAX} characters
          </span>
          <Button type="submit" aria-disabled={pending || undefined}>
            {pending ? "Asking Noor…" : "Ask Noor"}
          </Button>
        </div>
      </form>

      <div
        id="ask-noor-reply"
        aria-live="polite"
        aria-busy={pending || undefined}
        className="flex flex-col gap-3"
      >
        {state.kind === "answer" && (
          <div className="flex flex-col gap-3 rounded-[22px_22px_22px_6px] bg-card2 px-4 py-3">
            <p className="text-13 font-semibold text-sub">You asked: {state.question}</p>
            <p className="text-15 leading-relaxed">{state.answer}</p>
            <div>
              <p className="text-13 font-semibold text-sub">From the help center:</p>
              <ul className="mt-1 flex flex-col">
                {state.sources.map((s) => (
                  <li key={s.url}>
                    <Link
                      href={s.url}
                      className="inline-flex min-h-11 items-center text-15 font-semibold text-accent-text underline underline-offset-2"
                    >
                      {s.title}
                      {s.heading !== s.title ? `: ${s.heading.split(" · ")[0]}` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {state.kind === "message" && (
          <div className="flex flex-col gap-1 rounded-[22px_22px_22px_6px] bg-card2 px-4 py-3">
            {state.question && (
              <p className="text-13 font-semibold text-sub">You asked: {state.question}</p>
            )}
            <p
              className={`text-15 ${state.tone === "error" ? "font-semibold text-accent-text" : ""}`}
            >
              <InlineText text={state.text} />
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
