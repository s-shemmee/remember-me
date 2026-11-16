"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, ChoiceItem } from "@/components/ui/choice-group";
import { DateFields } from "@/components/ui/date-fields";
import { Field, FieldLabel, FieldNote } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { CHARACTERS, characterEmoji, PASTELS } from "@/features/onboarding/constants";
import { ColorSwatches } from "@/features/people/components/color-swatches";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Pastel } from "@/styles/tokens";

import { discardAvatarUpload, saveProfile } from "../actions";
import { checkImageFile, prepareAvatar } from "../avatar-image";
import { AVATARS_BUCKET, FIRST_NAME_MAX } from "../constants";

export type AboutYou = {
  firstName: string;
  look: {
    kind: "initials" | "character" | "photo";
    color: Pastel;
    character: string | null;
    photoPath: string | null;
  };
  birthday: { day: number | null; month: number | null; year: number | null };
  timezone: string;
};

const LOOK_KINDS = [
  { value: "initials", label: "Initials" },
  { value: "character", label: "Character" },
  { value: "photo", label: "Photo" },
] as const;

const chip =
  "inline-flex min-h-11 items-center rounded-pill bg-card2 px-4 text-15 font-semibold text-text data-[state=checked]:bg-text data-[state=checked]:text-bg";

/** Time zones this browser knows, with the current one first if missing. */
function timeZones(current: string): string[] {
  const all =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [current];
  return all.includes(current) ? all : [current, ...all];
}

/**
 * Profile → About you: first name, look (initials, character or photo;
 * colour; Shuffle), birthday (the year is optional and only ever shown to
 * you) and time zone (detected, can be changed). A photo is cropped and
 * re-encoded in the browser (no EXIF/GPS) and stored in your own folder.
 */
export function AboutYouForm({
  userId,
  initial,
  initialPhotoUrl,
}: {
  userId: string;
  initial: AboutYou;
  initialPhotoUrl: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);
  const [photoUrl, setPhotoUrl] = React.useState(initialPhotoUrl);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState("");
  const [busy, setBusy] = React.useState<"" | "upload" | "save">("");
  const unsaved = React.useRef<string | null>(null);
  const detected = React.useSyncExternalStore(
    () => () => undefined,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => initial.timezone,
  );
  const zones = React.useMemo(() => timeZones(value.timezone), [value.timezone]);

  const setLook = (patch: Partial<AboutYou["look"]>) =>
    setValue((v) => ({ ...v, look: { ...v.look, ...patch } }));

  const shuffle = () => {
    const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;
    setLook({
      kind: Math.random() < 0.5 ? "initials" : "character",
      color: pick(PASTELS),
      character: pick(CHARACTERS).key,
    });
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const check = checkImageFile(file);
    if (!check.ok) {
      setErrors((e) => ({ ...e, photo: check.message }));
      return;
    }
    setBusy("upload");
    setErrors((e) => ({ ...e, photo: "", look: "" }));
    try {
      const image = await prepareAvatar(file);
      const path = `${userId}/${crypto.randomUUID()}.${image.ext}`;
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, image.blob, { contentType: image.type, upsert: false });
      if (error) throw error;
      if (unsaved.current) void discardAvatarUpload(unsaved.current);
      unsaved.current = path;
      setPhotoUrl(URL.createObjectURL(image.blob));
      setLook({ kind: "photo", photoPath: path });
    } catch {
      setErrors((e) => ({ ...e, photo: "That photo didn't upload. Please try another one." }));
    } finally {
      setBusy("");
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("save");
    setStatus("");
    const result = await saveProfile({
      firstName: value.firstName,
      look: {
        ...value.look,
        character: value.look.character as never,
        photoPath: value.look.kind === "photo" ? value.look.photoPath : null,
      },
      birthday: {
        day: value.birthday.day ?? 0,
        month: value.birthday.month ?? 0,
        year: value.birthday.year,
      },
      timezone: value.timezone,
    });
    setBusy("");
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setStatus(result.message);
      return;
    }
    unsaved.current = null;
    setErrors({});
    setStatus("Saved ✓");
    router.refresh();
  };

  const name = value.firstName.trim() || "You";
  const emoji = value.look.kind === "character" ? characterEmoji(value.look.character) : null;

  return (
    <section
      aria-labelledby="about-you-title"
      className="flex flex-col gap-6 rounded-card-lg bg-card p-6 shadow-card sm:p-8"
    >
      <h2 id="about-you-title" className="text-22 font-extrabold tracking-[-0.02em]">
        About you
      </h2>
      <form onSubmit={(e) => void save(e)} noValidate className="flex flex-col gap-6">
        <Field
          id="profile-first-name"
          label="First name"
          value={value.firstName}
          maxLength={FIRST_NAME_MAX}
          autoComplete="given-name"
          error={errors.firstName}
          onChange={(e) => {
            const firstName = e.currentTarget.value;
            setValue((v) => ({ ...v, firstName }));
          }}
        />

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-14 font-semibold">How your people see you</legend>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar
              name={name}
              pastel={value.look.color}
              src={value.look.kind === "photo" ? photoUrl : null}
              character={emoji ?? null}
              decorative
              className={cn("size-24", emoji ? "text-[42px]" : "text-34")}
            />
            <div className="flex flex-col gap-2">
              <ChoiceGroup
                aria-label="Avatar"
                value={value.look.kind}
                onValueChange={(next) => {
                  const kind = next as AboutYou["look"]["kind"];
                  // Character with nothing picked yet: start with the first one.
                  setLook(
                    kind === "character" && !value.look.character
                      ? { kind, character: CHARACTERS[0].key }
                      : { kind },
                  );
                }}
              >
                {LOOK_KINDS.map((k) => (
                  <ChoiceItem key={k.value} value={k.value} className={chip}>
                    {k.label}
                  </ChoiceItem>
                ))}
              </ChoiceGroup>
              <Button type="button" variant="transparent" className="w-fit" onClick={shuffle}>
                Shuffle
              </Button>
            </div>
          </div>

          {value.look.kind === "character" && (
            <ChoiceGroup
              aria-label="Character"
              value={value.look.character ?? ""}
              onValueChange={(character) => setLook({ character })}
              className="grid grid-cols-4 gap-2 sm:max-w-sm"
            >
              {CHARACTERS.map((c) => (
                <ChoiceItem
                  key={c.key}
                  value={c.key}
                  aria-label={c.label}
                  className="grid aspect-square place-items-center rounded-[16px] bg-card2 text-[28px] data-[state=checked]:shadow-[0_0_0_2.5px_var(--text)]"
                >
                  <span aria-hidden>{c.emoji}</span>
                </ChoiceItem>
              ))}
            </ChoiceGroup>
          )}

          {value.look.kind === "photo" && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="profile-photo">Your photo</FieldLabel>
              <input
                id="profile-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-describedby="profile-photo-note"
                aria-invalid={errors.photo ? true : undefined}
                disabled={busy === "upload"}
                onChange={(e) => void upload(e.currentTarget.files?.[0])}
                className="w-full max-w-full min-w-0 text-14 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-pill file:border-0 file:bg-card2 file:px-4 file:text-15 file:font-semibold file:text-text"
              />
              <FieldNote id="profile-photo-note" error={Boolean(errors.photo || errors.look)}>
                {busy === "upload"
                  ? "Uploading…"
                  : errors.photo ||
                    errors.look ||
                    "JPEG, PNG or WebP. I crop it square and remove its location data."}
              </FieldNote>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span id="profile-colour" className="text-14 font-semibold">
              Colour
            </span>
            <ColorSwatches
              labelId="profile-colour"
              value={value.look.color}
              onChange={(color) => setLook({ color })}
            />
          </div>
        </fieldset>

        <DateFields
          idPrefix="profile-birthday"
          legend="Your birthday"
          hint="The year is private: only the day and month are ever shown."
          value={value.birthday}
          onChange={(patch) => setValue((v) => ({ ...v, birthday: { ...v.birthday, ...patch } }))}
          errors={{ day: errors.birthday }}
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
              setValue((v) => ({ ...v, timezone }));
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
              onClick={() => setValue((v) => ({ ...v, timezone: detected }))}
            >
              Use this device&apos;s time zone ({detected.replace(/_/g, " ")})
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy !== ""}>
            {busy === "save" ? "Saving…" : "Save changes"}
          </Button>
          <p
            role="status"
            aria-live="polite"
            className={
              status && status !== "Saved ✓"
                ? "text-14 font-semibold text-accent-text"
                : "text-14 text-sub"
            }
          >
            {status}
          </p>
        </div>
      </form>
    </section>
  );
}
