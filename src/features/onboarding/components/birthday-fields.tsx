"use client";

import * as React from "react";

import { FieldNote, fieldInputClass } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";

import { MONTHS } from "../constants";

type Value = { day: number | null; month: number | null; year: number | null };

/**
 * Birthday as day + month (required) and an optional, private year.
 * A fieldset with a visible legend labels the group; each select has its
 * own accessible name. Errors are text linked to the field they're about.
 */
export function BirthdayFields({
  legend,
  hint,
  value,
  onChange,
  errors,
  idPrefix,
}: {
  legend: string;
  hint?: string;
  value: Value;
  onChange: (patch: Partial<Value>) => void;
  errors: Partial<Record<"day" | "month" | "year", string>>;
  idPrefix: string;
}) {
  const hintId = `${idPrefix}-hint`;
  const errorId = `${idPrefix}-error`;
  const dateError = errors.day ?? errors.month;
  const describedBy = (field: "date" | "year") =>
    [
      hint && hintId,
      field === "date" && dateError && errorId,
      field === "year" && errors.year && `${idPrefix}-year-error`,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const toNumber = (v: string) => (v === "" ? null : Number(v));

  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-14 font-semibold text-text">{legend}</legend>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.2fr)] gap-2">
        <SelectField
          id={`${idPrefix}-day`}
          aria-label="Day"
          value={value.day ?? ""}
          invalid={Boolean(errors.day)}
          aria-describedby={describedBy("date")}
          onChange={(e) => onChange({ day: toNumber(e.currentTarget.value) })}
        >
          <option value="">Day</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </SelectField>
        <SelectField
          id={`${idPrefix}-month`}
          aria-label="Month"
          value={value.month ?? ""}
          invalid={Boolean(errors.month)}
          aria-describedby={describedBy("date")}
          onChange={(e) => onChange({ month: toNumber(e.currentTarget.value) })}
        >
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </SelectField>
        <input
          id={`${idPrefix}-year`}
          aria-label="Year (optional)"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Year"
          maxLength={4}
          value={value.year ?? ""}
          aria-invalid={errors.year ? true : undefined}
          aria-describedby={describedBy("year")}
          onChange={(e) => {
            const digits = e.currentTarget.value.replace(/\D/g, "").slice(0, 4);
            onChange({ year: digits === "" ? null : Number(digits) });
          }}
          className={cn(fieldInputClass)}
        />
      </div>
      {hint && (
        <p id={hintId} className="text-13 text-sub">
          {hint}
        </p>
      )}
      {dateError && (
        <FieldNote id={errorId} error>
          {dateError}
        </FieldNote>
      )}
      {errors.year && (
        <FieldNote id={`${idPrefix}-year-error`} error>
          {errors.year}
        </FieldNote>
      )}
    </fieldset>
  );
}
