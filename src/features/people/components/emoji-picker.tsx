"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { fieldInputClass, FieldNote } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { DEFAULT_EMOJI, EMOJI_GRID, isSingleEmoji } from "../little-emoji";

const COLUMNS = 8;

/**
 * The emoji of a little thing: a button showing it ("Choose an emoji for
 * black coffee") that opens a small popover: a grid of common emoji (arrow
 * keys move, Enter picks), "Or type any emoji" (exactly one), and "Reset to
 * heart". Escape closes it and focus goes back to the button.
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
  const [active, setActive] = React.useState(0);
  const [custom, setCustom] = React.useState("");
  const [error, setError] = React.useState("");
  const cells = React.useRef<(HTMLButtonElement | null)[]>([]);
  const id = React.useId();

  const pick = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
  };

  const move = (event: React.KeyboardEvent, index: number) => {
    const last = EMOJI_GRID.length - 1;
    const next =
      event.key === "ArrowRight"
        ? Math.min(index + 1, last)
        : event.key === "ArrowLeft"
          ? Math.max(index - 1, 0)
          : event.key === "ArrowDown"
            ? Math.min(index + COLUMNS, last)
            : event.key === "ArrowUp"
              ? Math.max(index - COLUMNS, 0)
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? last
                  : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    cells.current[next]?.focus();
  };

  const applyCustom = () => {
    const e = custom.trim();
    if (!isSingleEmoji(e)) {
      setError("Type or paste one emoji.");
      return;
    }
    setCustom("");
    setError("");
    pick(e);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          const at = EMOJI_GRID.findIndex((g) => g.emoji === value);
          setActive(at >= 0 ? at : 0);
          setCustom("");
          setError("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Choose an emoji for ${label}`}
          className={cn(
            "grid size-11 shrink-0 cursor-pointer place-items-center rounded-[14px] bg-card2 hover-tint text-[22px] leading-none",
            className,
          )}
        >
          <span aria-hidden>{value || DEFAULT_EMOJI}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={`Emoji for ${label}`}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          requestAnimationFrame(() => cells.current[active]?.focus());
        }}
        className="flex flex-col gap-3"
      >
        <div
          role="group"
          aria-label="Common emoji"
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
        >
          {EMOJI_GRID.map((g, i) => (
            <button
              key={g.emoji}
              ref={(el) => {
                cells.current[i] = el;
              }}
              type="button"
              tabIndex={i === active ? 0 : -1}
              aria-label={g.name}
              aria-pressed={g.emoji === value}
              onClick={() => pick(g.emoji)}
              onKeyDown={(e) => move(e, i)}
              onFocus={() => setActive(i)}
              className="grid aspect-square min-h-10 cursor-pointer place-items-center rounded-[10px] hover-tint text-[20px] leading-none aria-pressed:bg-card2 aria-pressed:shadow-[inset_0_0_0_2px_var(--text)]"
            >
              <span aria-hidden>{g.emoji}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-custom`} className="text-13 font-semibold">
            Or type any emoji
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-custom`}
              value={custom}
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(e) => {
                setCustom(e.currentTarget.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyCustom();
                }
              }}
              className={cn(fieldInputClass, "h-11 min-w-0 flex-1 text-[18px]")}
            />
            <Button type="button" variant="card2" onClick={applyCustom}>
              Use
            </Button>
          </div>
          {error && (
            <FieldNote id={`${id}-error`} error>
              {error}
            </FieldNote>
          )}
        </div>

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
