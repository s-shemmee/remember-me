"use client";

import { CheckIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

import { fieldInputClass, FieldLabel, FieldNote } from "./field";

/**
 * Password input with a 44px show/hide button and, for new passwords, a live
 * "8 characters or more" check announced politely as it turns green.
 * Same look as Field.
 */
function PasswordField({
  label = "Password",
  labelAside,
  error,
  minLength,
  id,
  className,
  onChange,
  ...inputProps
}: Omit<React.ComponentProps<"input">, "id" | "type"> & {
  label?: React.ReactNode;
  labelAside?: React.ReactNode;
  error?: React.ReactNode;
  /** Show the live length check (sign-up and new password). */
  minLength?: number;
  id?: string;
}) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const checkId = `${inputId}-check`;
  const errorId = `${inputId}-error`;
  const [shown, setShown] = React.useState(false);
  const [length, setLength] = React.useState(0);
  const longEnough = minLength !== undefined && length >= minLength;

  const describedBy = [minLength !== undefined && checkId, error && errorId]
    .filter(Boolean)
    .join(" ");

  return (
    <div data-slot="password-field" className={cn("grid gap-1.5", className)}>
      <FieldLabel htmlFor={inputId} aside={labelAside}>
        {label}
      </FieldLabel>
      <div className="relative">
        <input
          id={inputId}
          type={shown ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(fieldInputClass, "pr-14")}
          onChange={(event) => {
            setLength(event.currentTarget.value.length);
            onChange?.(event);
          }}
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          aria-controls={inputId}
          className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-pill text-sub transition-colors duration-200 ease-soft hover:bg-card2 hover:text-text"
        >
          {shown ? (
            <EyeOffIcon className="size-5" aria-hidden />
          ) : (
            <EyeIcon className="size-5" aria-hidden />
          )}
        </button>
      </div>
      {minLength !== undefined && (
        <p
          id={checkId}
          aria-live="polite"
          className={cn(
            "mt-1 flex items-center gap-2 text-14 transition-colors duration-200 ease-soft",
            longEnough ? "text-mint-ink" : "text-sub",
          )}
        >
          {/* Design: solid dot, line when unmet; met = green with a ✓. The
              design's green isn't a token, so it's mint-ink with a card-colour
              tick (6.5:1 in light, also passes in dark). */}
          <span
            aria-hidden
            className={cn(
              "grid size-[18px] shrink-0 place-items-center rounded-pill transition-colors duration-200 ease-soft",
              longEnough ? "bg-mint-ink text-card" : "bg-line",
            )}
          >
            {longEnough && <CheckIcon className="size-3" strokeWidth={3.5} />}
          </span>
          <span className="sr-only">{longEnough ? "Done:" : "Needs:"}</span> {minLength} characters
          or more
        </p>
      )}
      {error && (
        <FieldNote id={errorId} error>
          {error}
        </FieldNote>
      )}
    </div>
  );
}

export { PasswordField };
