import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Field: visible label above a 52px input, 1.5px line border, focus = accent
 * border + 4px soft ring. Helper text below in `sub`; an error replaces it,
 * is shown as text (not only colour) and is linked with aria-describedby.
 */
function Field({
  label,
  helper,
  error,
  id,
  className,
  inputClassName,
  ...inputProps
}: Omit<React.ComponentProps<"input">, "id"> & {
  label: React.ReactNode;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  id?: string;
  inputClassName?: string;
}) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const noteId = `${inputId}-note`;
  const note = error ?? helper;

  return (
    <div data-slot="field" className={cn("grid gap-2", className)}>
      <label htmlFor={inputId} className="text-15 font-semibold text-text">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          "h-[52px] w-full rounded-input border-[1.5px] border-line bg-card px-4 text-17 text-text",
          "transition-[border-color,box-shadow] duration-200 ease-soft placeholder:text-sub",
          "focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_20%,transparent)] focus:outline-none",
          "aria-invalid:border-accent-text",
          "disabled:cursor-not-allowed disabled:opacity-50",
          inputClassName,
        )}
        {...inputProps}
      />
      {note && (
        <p
          id={noteId}
          className={cn("text-13", error ? "font-semibold text-accent-text" : "text-sub")}
        >
          {error && <span className="sr-only">Error:</span>} {note}
        </p>
      )}
    </div>
  );
}

export { Field };
