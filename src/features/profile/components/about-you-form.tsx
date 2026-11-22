"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { DateFields } from "@/components/ui/date-fields";
import { Field, FieldLabel, FieldNote } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";

import { saveAbout } from "../actions";
import { CITY_MAX, FIRST_NAME_MAX, LAST_NAME_MAX, LITTLE_LINE_MAX } from "../constants";

const SAVED = "Saved";

export type AboutYou = {
  firstName: string;
  lastName: string;
  birthday: { day: number | null; month: number | null; year: number | null };
  city: string;
  /** The little line about you (profiles.bio). */
  bio: string;
  timezone: string;
};

/** Time zones this browser knows, with the current one first if missing. */
function timeZones(current: string): string[] {
  const all =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [current];
  return all.includes(current) ? all : [current, ...all];
}

/**
 * Profile → About you: first and last name, birthday (the year is optional
 * and only ever shown to you), city, a little line about you, and time zone
 * (detected, can be changed). Your avatar is edited on the header card.
 */
export function AboutYouForm({ initial }: { initial: AboutYou }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  // Any change after "Saved" turns the button back into "Save".
  const edit = (update: (v: AboutYou) => AboutYou) => {
    setStatus((s) => (s === SAVED ? "" : s));
    setValue(update);
  };
  const detected = React.useSyncExternalStore(
    () => () => undefined,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => initial.timezone,
  );
  const zones = React.useMemo(() => timeZones(value.timezone), [value.timezone]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const result = await saveAbout({
      firstName: value.firstName,
      lastName: value.lastName,
      city: value.city,
      bio: value.bio,
      birthday: {
        day: value.birthday.day ?? 0,
        month: value.birthday.month ?? 0,
        year: value.birthday.year,
      },
      timezone: value.timezone,
    });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setStatus(result.message);
      return;
    }
    setErrors({});
    setStatus(SAVED);
    router.refresh();
  };

  return (
    <section
      aria-labelledby="about-you-title"
      className="flex flex-col gap-6 rounded-card-lg bg-card p-6 shadow-card sm:p-8"
    >
      <h2 id="about-you-title" className="text-22 font-extrabold tracking-[-0.02em]">
        About you
      </h2>
      <form onSubmit={(e) => void save(e)} noValidate className="flex flex-col gap-6">
        {/* First name | Last name, Birthday | City; one column on phones. */}
        <div className="grid items-start gap-6 md:grid-cols-2">
          <Field
            id="profile-first-name"
            label="First name"
            value={value.firstName}
            maxLength={FIRST_NAME_MAX}
            autoComplete="given-name"
            error={errors.firstName}
            onChange={(e) => {
              const firstName = e.currentTarget.value;
              edit((v) => ({ ...v, firstName }));
            }}
          />

          <Field
            id="profile-last-name"
            label="Last name"
            value={value.lastName}
            maxLength={LAST_NAME_MAX}
            autoComplete="family-name"
            error={errors.lastName}
            onChange={(e) => {
              const lastName = e.currentTarget.value;
              edit((v) => ({ ...v, lastName }));
            }}
          />

          <DateFields
            idPrefix="profile-birthday"
            legend="Your birthday"
            hint="Year is private. Only day and month are shown."
            value={value.birthday}
            onChange={(patch) => edit((v) => ({ ...v, birthday: { ...v.birthday, ...patch } }))}
            errors={{ day: errors.birthday }}
          />

          <Field
            id="profile-city"
            label="City"
            value={value.city}
            maxLength={CITY_MAX}
            autoComplete="address-level2"
            error={errors.city}
            onChange={(e) => {
              const city = e.currentTarget.value;
              edit((v) => ({ ...v, city }));
            }}
          />
        </div>

        <Field
          id="profile-bio"
          label="A little line about you"
          helper="A few words your people see on your profile."
          value={value.bio}
          maxLength={LITTLE_LINE_MAX}
          error={errors.bio}
          onChange={(e) => {
            const bio = e.currentTarget.value;
            edit((v) => ({ ...v, bio }));
          }}
        />

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="profile-timezone">Time zone</FieldLabel>
          <SelectField
            id="profile-timezone"
            value={value.timezone}
            aria-describedby="profile-timezone-note"
            invalid={Boolean(errors.timezone)}
            onChange={(e) => {
              const timezone = e.currentTarget.value;
              edit((v) => ({ ...v, timezone }));
            }}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </SelectField>
          <FieldNote id="profile-timezone-note" error={Boolean(errors.timezone)}>
            {errors.timezone ?? "Reminders arrive at 9:00 in this time zone."}
          </FieldNote>
          {detected && detected !== value.timezone && (
            <Button
              type="button"
              variant="transparent"
              className="w-fit"
              onClick={() => edit((v) => ({ ...v, timezone: detected }))}
            >
              Use this device&apos;s time zone ({detected.replace(/_/g, " ")})
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : status === SAVED ? "Saved" : "Save changes"}
          </Button>
          <p
            role="status"
            aria-live="polite"
            className={
              status === SAVED ? "sr-only" : "text-14 font-semibold text-accent-text empty:hidden"
            }
          >
            {status}
          </p>
        </div>
      </form>
    </section>
  );
}
