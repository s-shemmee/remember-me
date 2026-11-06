import * as React from "react";

import { cn } from "@/lib/utils";

/** The 52px input look shared by Field and PasswordField. */
export const fieldInputClass = cn(
  "h-[52px] w-full rounded-input border-[1.5px] border-line bg-card px-4 text-17 text-text",
  "transition-[border-color,box-shadow] duration-200 ease-soft placeholder:text-sub",
  "focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_20%,transparent)] focus:outline-none",
  "aria-invalid:border-accent-text",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/** Label row: the label, plus an optional link on the right ("Forgot password?"). */
export function FieldLabel({
  htmlFor,
  children,
  aside,
}: {
  htmlFor: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-15 font-semibold text-text">
        {children}
      </label>
      {aside}
    </div>
  );
}

/** Helper or error text under a field. Errors are text, not only colour. */
export function FieldNote({
  id,
  error,
  children,
}: {
  id: string;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p id={id} className={cn("text-13", error ? "font-semibold text-accent-text" : "text-sub")}>
      {error && <span className="sr-only">Error:</span>} {children}
    </p>
  );
}

/**
 * Field: visible label above a 52px input, 1.5px line border, focus = accent
 * border + 4px soft ring. Helper text below in `sub`; an error replaces it,
 * is shown as text (not only colour) and is linked with aria-describedby.
 */
function Field({
  label,
  labelAside,
  helper,
  error,
  id,
  className,
  inputClassName,
  ...inputProps
}: Omit<React.ComponentProps<"input">, "id"> & {
  label: React.ReactNode;
  labelAside?: React.ReactNode;
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
      <FieldLabel htmlFor={inputId} aside={labelAside}>
        {label}
      </FieldLabel>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(fieldInputClass, inputClassName)}
        {...inputProps}
      />
      {note && (
        <FieldNote id={noteId} error={Boolean(error)}>
          {note}
        </FieldNote>
      )}
    </div>
  );
}

export { Field };
