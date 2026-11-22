"use client";

import { EmojiPicker as Frimousse } from "frimousse";

/**
 * The picker itself (frimousse): search, categories with sticky headers,
 * skin tones, arrow-key navigation and a live region for the active emoji.
 * Loaded only when the popover opens (see emoji-picker.tsx). The emoji data
 * comes from our own /emojibase route, never a CDN.
 */
export default function EmojiPickerPanel({
  searchId,
  onPick,
}: {
  searchId: string;
  onPick: (emoji: string) => void;
}) {
  return (
    <Frimousse.Root
      emojibaseUrl="/emojibase"
      columns={8}
      onEmojiSelect={({ emoji }) => onPick(emoji)}
      className="isolate flex h-[340px] w-[min(19.5rem,calc(100vw-3rem))] flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <label htmlFor={searchId} className="sr-only">
          Search emoji
        </label>
        <Frimousse.Search
          id={searchId}
          placeholder="Search emoji…"
          className="min-h-11 min-w-0 flex-1 rounded-pill border-[1.5px] border-line bg-card px-4 text-15 text-text placeholder:text-sub focus:border-accent focus:outline-none"
        />
        <Frimousse.SkinToneSelector
          aria-label="Change skin tone"
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-pill bg-card2 hover-tint text-[20px]"
        />
      </div>
      <Frimousse.Viewport className="relative min-h-0 flex-1 rounded-[14px] outline-none">
        <Frimousse.Loading className="absolute inset-0 grid place-items-center text-14 text-sub">
          Loading emoji…
        </Frimousse.Loading>
        <Frimousse.Empty className="absolute inset-0 grid place-items-center text-14 text-sub">
          {({ search }) => <>No emoji for “{search}”.</>}
        </Frimousse.Empty>
        <Frimousse.List
          className="pb-1 select-none"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div
                {...props}
                className="bg-card px-1 pt-2 pb-1 text-12 font-bold tracking-[.05em] text-sub uppercase"
              >
                {category.label}
              </div>
            ),
            // frimousse numbers rows from 0, but aria-rowindex starts at 1:
            // the first row goes without one (frimousse scrolls to the top
            // for row 0 without looking it up, so keyboard scrolling holds).
            Row: ({ children, "aria-rowindex": rowIndex, ...props }) => (
              <div
                {...props}
                aria-rowindex={rowIndex === 0 ? undefined : rowIndex}
                className="flex gap-0.5 px-0.5"
              >
                {children}
              </div>
            ),
            // Columns too: frimousse counts from 0, aria-colindex from 1.
            Emoji: ({ emoji, "aria-colindex": colIndex, ...props }) => (
              <button
                {...props}
                role="gridcell"
                aria-colindex={typeof colIndex === "number" ? colIndex + 1 : colIndex}
                className={`grid size-9 cursor-pointer place-items-center rounded-[10px] text-[20px] leading-none ${emoji.isActive ? "bg-card2" : ""}`}
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </Frimousse.Viewport>
    </Frimousse.Root>
  );
}
