"use client";

import { ShareIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { fieldInputClass } from "@/components/ui/field";
import { createInvite } from "@/features/connections/actions";
import { cn } from "@/lib/utils";

import { SHARE_TEXT } from "../countdown";

/**
 * "Share with my people": makes a fresh invite link (it works once, for one
 * person, for 7 days) and opens the share sheet on phones, or copies the
 * text and link. Nothing is posted anywhere.
 */
export function ShareWishlistButton() {
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [fallback, setFallback] = React.useState<string | null>(null);
  const fallbackId = React.useId();

  const share = async () => {
    setBusy(true);
    setFallback(null);
    const result = await createInvite();
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    const full = `${SHARE_TEXT} ${result.url}`;
    const phone = window.matchMedia("(pointer: coarse)").matches;
    if (phone && typeof navigator.share === "function") {
      try {
        await navigator.share({ text: SHARE_TEXT, url: result.url });
        setMessage("Shared. That link works for one person, for 7 days.");
        return;
      } catch (error) {
        // Closed the share sheet: nothing to say.
        if (error instanceof DOMException && error.name === "AbortError") return setMessage("");
      }
    }
    try {
      await navigator.clipboard.writeText(full);
      setMessage("Link copied. It works for one person, for 7 days.");
    } catch {
      // No clipboard (permissions, an old browser): show it to copy by hand.
      setFallback(full);
      setMessage("Copy the text below to share it.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="card2"
        onClick={() => void share()}
        disabled={busy}
        className="self-start bg-card"
      >
        <ShareIcon aria-hidden /> Share with my people
      </Button>
      <p role="status" aria-live="polite" className="text-13 font-semibold text-sub empty:hidden">
        {message}
      </p>
      {fallback && (
        <>
          <label htmlFor={fallbackId} className="sr-only">
            Your invite text and link
          </label>
          <textarea
            id={fallbackId}
            readOnly
            rows={3}
            value={fallback}
            onFocus={(e) => e.currentTarget.select()}
            className={cn(fieldInputClass, "h-auto resize-none py-3 text-14")}
          />
        </>
      )}
    </div>
  );
}
