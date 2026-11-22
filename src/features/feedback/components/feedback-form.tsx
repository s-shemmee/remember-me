"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ChoiceGroup, ChoiceItem } from "@/components/ui/choice-group";
import { FieldNote } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";

import { sendFeedback } from "../actions";
import {
  browserLabel,
  FEEDBACK_LABELS,
  FEEDBACK_MAX,
  FEEDBACK_TYPES,
  type FeedbackMeta,
  type FeedbackType,
  safeRoute,
} from "../schema";

const chip =
  "inline-flex min-h-11 items-center rounded-pill bg-card2 px-4 text-15 font-semibold text-text data-[state=checked]:bg-text data-[state=checked]:text-bg";

/** The page you came from (same site), else this one: the section only. */
function currentRoute(fallback: string): string {
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.origin === window.location.origin) return safeRoute(ref.pathname);
  } catch {
    // An odd referrer: use this page.
  }
  return safeRoute(fallback);
}

/**
 * Help & feedback → Send feedback: what it's about, the message (up to
 * 1000 characters, with a count), and, for "Something's broken" only, a
 * switch to attach browser, screen size and the route (never people,
 * wishes or names). Sent: a mint thank-you with "Send another".
 */
export function FeedbackForm() {
  const pathname = usePathname();
  const [type, setType] = React.useState<FeedbackType | "">("");
  const [message, setMessage] = React.useState("");
  const [includeInfo, setIncludeInfo] = React.useState(true);
  const [error, setError] = React.useState<{ text: string; field?: "type" | "message" } | null>(
    null,
  );
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const thanks = React.useRef<HTMLHeadingElement>(null);
  const messageRef = React.useRef<HTMLTextAreaElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!type) return setError({ text: "Pick what it's about.", field: "type" });
    if (!message.trim()) return setError({ text: "Write a few words first.", field: "message" });
    setBusy(true);
    setError(null);
    const meta: FeedbackMeta | null =
      type === "broken" && includeInfo
        ? {
            browser: browserLabel(navigator.userAgent),
            screen: `${window.screen.width}x${window.screen.height}`,
            route: currentRoute(pathname),
          }
        : null;
    const result = await sendFeedback({ type, message, meta });
    setBusy(false);
    if (!result.ok) return setError({ text: result.message, field: result.field });
    setSent(true);
    requestAnimationFrame(() => thanks.current?.focus());
  };

  if (sent) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-[20px] bg-mint p-5 text-mint-ink">
        <div className="flex min-w-0 flex-1 basis-[240px] flex-col gap-1">
          <h3 ref={thanks} tabIndex={-1} className="text-17 font-bold outline-none">
            Thank you, it&apos;s sent
          </h3>
          <p className="text-15">
            I read every message. If you asked something, I&apos;ll reply by email.
          </p>
        </div>
        <Button
          variant="card"
          className="ml-auto"
          onClick={() => {
            setSent(false);
            setType("");
            setMessage("");
            requestAnimationFrame(() => messageRef.current?.focus());
          }}
        >
          Send another
        </Button>
      </div>
    );
  }

  const typeError = error?.field === "type";
  const messageError = error?.field === "message";
  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-5">
      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={typeError ? "feedback-type-error" : undefined}
      >
        <legend id="feedback-type-label" className="mb-1 text-15 font-semibold">
          What is it about?
        </legend>
        <ChoiceGroup
          aria-labelledby="feedback-type-label"
          value={type}
          onValueChange={(v) => setType(v as FeedbackType)}
        >
          {FEEDBACK_TYPES.map((t) => (
            <ChoiceItem key={t} value={t} className={chip}>
              {FEEDBACK_LABELS[t]}
            </ChoiceItem>
          ))}
        </ChoiceGroup>
        {typeError && (
          <FieldNote id="feedback-type-error" error>
            {error.text}
          </FieldNote>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="feedback-message" className="text-15 font-semibold">
          Your message
        </label>
        <textarea
          ref={messageRef}
          id="feedback-message"
          rows={5}
          maxLength={FEEDBACK_MAX}
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          aria-invalid={messageError || undefined}
          aria-describedby={
            messageError ? "feedback-count feedback-message-error" : "feedback-count"
          }
          className="min-h-28 w-full resize-y rounded-[16px] border-[1.5px] border-line bg-card px-4 py-3 text-15 text-text placeholder:text-sub focus:border-accent focus:outline-none"
          placeholder="Tell me what you'd love, or what went wrong."
        />
        <span id="feedback-count" className="text-13 text-sub">
          {message.length}/{FEEDBACK_MAX} characters
        </span>
        {messageError && (
          <FieldNote id="feedback-message-error" error>
            {error.text}
          </FieldNote>
        )}
      </div>

      {type === "broken" && (
        <div className="flex items-center justify-between gap-4 rounded-[16px] bg-card2 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <label htmlFor="feedback-info" className="text-15 font-bold">
              Attach my browser and screen size (helps fix the bug)
            </label>
            <span id="feedback-info-hint" className="text-13 text-sub">
              And the page you were on. Never your people, wishes or names.
            </span>
          </div>
          <Switch
            id="feedback-info"
            aria-describedby="feedback-info-hint"
            checked={includeInfo}
            onCheckedChange={setIncludeInfo}
          />
        </div>
      )}

      <p role="alert" className="text-14 font-semibold text-accent-text empty:hidden">
        {error && !error.field ? error.text : ""}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-14 text-sub">
          Prefer email?{" "}
          <a
            href={CONTACT_MAILTO}
            className="inline-flex min-h-11 items-center font-semibold text-accent-text underline-offset-4 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send feedback"}
        </Button>
      </div>
    </form>
  );
}
