"use client";

import dynamic from "next/dynamic";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { DEFAULT_EMOJI } from "../little-emoji";

/** Loaded on first open: the picker and its data stay out of the page bundle. */
const EmojiPickerPanel = dynamic(() => import("./emoji-picker-panel"), {
  ssr: false,
  loading: () => (
    <p className="grid h-[340px] w-[min(19.5rem,calc(100vw-3rem))] place-items-center text-14 text-sub">
      Loading emoji…
    </p>
  ),
});

/**
 * The emoji of a little thing: a button showing it ("Choose an emoji for
 * black coffee") that opens a popover with the full emoji picker (search,
 * categories, skin tones; arrow keys move, Enter picks) and "Reset to
 * heart". Escape closes it and focus goes back to the button. The keyword
 * suggestion (coffee → ☕) is the form's job, before anyone picks.
 */
export function EmojiPicker({
  value,
  label,
  onChange,
  className,
}: {
  value: string;
  /** What it's for, e.g. "black coffee". */
  label: string;
  onChange: (emoji: string) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const searchId = React.useId();

  const pick = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Choose an emoji for ${label}`}
          className={cn(
            "grid size-11 shrink-0 cursor-pointer place-items-center rounded-[14px] bg-card2 hover-tint text-[22px] leading-none",
            className,
          )}
        >
          <span aria-hidden="true">{value || DEFAULT_EMOJI}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={`Emoji for ${label}`}
        onOpenAutoFocus={(e) => {
          // Focus the search once the lazy picker is there.
          e.preventDefault();
          const focus = (tries = 20) => {
            const el = document.getElementById(searchId);
            if (el) el.focus();
            else if (tries > 0) requestAnimationFrame(() => focus(tries - 1));
          };
          focus();
        }}
        className="flex w-auto flex-col gap-2 p-3"
      >
        <EmojiPickerPanel searchId={searchId} onPick={pick} />
        <Button
          type="button"
          variant="transparent"
          className="self-start px-3"
          onClick={() => pick(DEFAULT_EMOJI)}
        >
          Reset to heart
        </Button>
      </PopoverContent>
    </Popover>
  );
}
