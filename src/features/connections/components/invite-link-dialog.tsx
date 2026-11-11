"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fieldInputClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { createInvite } from "../actions";

/**
 * Makes a new invite link as soon as it opens (optionally for one of your
 * people, who's linked when they accept) and shows it with Copy. The link
 * is only shown here: just its hash is stored, so it can't be shown again.
 */
export function InviteLinkDialog({
  open,
  onOpenChange,
  personId = null,
  personName = null,
  onCreated,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId?: string | null;
  personName?: string | null;
  onCreated?: () => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const [link, setLink] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState("Making your link…");
  const [copied, setCopied] = React.useState(false);
  const started = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open || started.current) return;
    started.current = true;
    void createInvite(personId).then((result) => {
      if (result.ok) {
        setLink(result.url);
        setStatus("Your link is ready.");
        onCreated?.();
        requestAnimationFrame(() => inputRef.current?.select());
      } else {
        setError(result.message);
        setStatus(result.message);
      }
    });
  }, [open, personId, onCreated]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setStatus("Link copied.");
    } catch {
      inputRef.current?.select();
      setStatus("Select the link and copy it.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle className="[overflow-wrap:anywhere]">
            {personName ? `Invite ${personName} to Remember Me` : "Invite someone"}
          </DialogTitle>
          <DialogDescription>
            {personName
              ? `Send ${personName} this link. When they accept, you're connected, and they're linked to ${personName} in your People.`
              : "Send this link to someone you'd like to connect with."}{" "}
            It works once, for 7 days.
          </DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="grid gap-2">
            <label htmlFor="invite-link" className="text-14 font-semibold">
              Invite link
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                id="invite-link"
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className={cn(fieldInputClass, "min-w-0 flex-1 text-14")}
              />
              <Button onClick={copy} className="h-[52px]">
                {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-13 text-sub">
              For safety I only show a link once. If it gets lost, just make a new one.
            </p>
          </div>
        ) : error ? (
          <p className="text-15 font-semibold text-accent-text">{error}</p>
        ) : (
          <div aria-busy="true" className="h-[52px] rounded-input bg-card2" />
        )}
        <p aria-live="polite" className="sr-only">
          {status}
        </p>
      </DialogContent>
    </Dialog>
  );
}
