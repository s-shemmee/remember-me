"use client";

import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { pastelClasses } from "@/components/ui/chip";
import { DateFields } from "@/components/ui/date-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldNote, fieldInputClass } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";

import { removePerson, savePerson } from "../actions";
import { DEFAULT_EMOJI, suggestEmoji } from "../little-emoji";
import { EmojiPicker } from "./emoji-picker";
import {
  DAY_TITLE_MAX,
  DESCRIPTION_MAX,
  LITTLE_THING_MAX,
  LITTLE_THINGS_LIMIT,
  NAME_MAX,
  OTHER_DAYS_LIMIT,
  RELATION_COLORS,
} from "../constants";
import {
  type OtherDayValues,
  type PersonFormValues,
  personFieldErrors,
  personFormSchema,
} from "../schema";
import { ChoiceGroup, ChoiceItem } from "@/components/ui/choice-group";
import {
  OCCASION_TYPES,
  occasionType,
  OTHER_DAY_KINDS,
  type OtherDayKind,
} from "@/features/occasions/types";

import { ColorSwatches } from "./color-swatches";
import { RelationChips } from "./relation-chips";

type Errors = Record<string, string>;

export const emptyPersonForm = (): PersonFormValues => ({
  id: null,
  name: "",
  relationKind: "Best friend",
  description: "",
  color: RELATION_COLORS["Best friend"],
  day: null,
  month: null,
  year: null,
  littleThings: [],
  days: [],
});

/** The element to focus for an error key ("name", "days.1.title"…). */
function fieldIdFor(key: string): string {
  const [head, index, field] = key.split(".");
  if (head === "days" && index !== undefined) {
    if (field === "day" || field === "month" || field === "year") return `pf-day-${index}-${field}`;
    return `pf-day-${index}-${field ?? "kind"}`;
  }
  if (head === "littleThings") return "pf-little";
  if (head === "day" || head === "month" || head === "year") return `pf-bday-${head}`;
  return `pf-${head}`;
}

/** The one message the dialog announces (the fields show their own). */
function summary(errors: Errors): string {
  if (errors.name || errors.day || errors.month) {
    return "Add their name and birthday to save.";
  }
  return Object.values(errors)[0] ?? "Something needs a quick look.";
}

export type PersonDialogResult =
  | { kind: "saved"; id: string; name: string; added: boolean }
  | { kind: "removed"; id: string; name: string };

/**
 * Add or edit a person: name (40 characters), relation chip, how you'd
 * describe them, colour (follows the relation until you pick one), birthday,
 * other days and little things. Editing also offers Remove, with a
 * confirmation; removing archives them and the page offers Undo.
 * Save is never disabled: it says what's missing and focuses it.
 */
export function PersonDialog({
  open,
  onOpenChange,
  initial,
  onDone,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The person to edit, or an empty form to add someone. */
  initial: PersonFormValues;
  onDone: (result: PersonDialogResult) => void;
  /** Where focus goes after closing (there's no Radix trigger to return to). */
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const editing = Boolean(initial.id);
  const [values, setValues] = React.useState(initial);
  const [colorPicked, setColorPicked] = React.useState(
    editing && initial.color !== RELATION_COLORS[initial.relationKind],
  );
  const [errors, setErrors] = React.useState<Errors>({});
  const [message, setMessage] = React.useState("");
  const [thingDraft, setThingDraft] = React.useState("");
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  const update = (patch: Partial<PersonFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    if (message) setMessage("");
  };
  const clearError = (...keys: string[]) =>
    setErrors((e) => {
      if (!keys.some((k) => k in e)) return e;
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });

  const showErrors = (next: Errors, announce?: string) => {
    setErrors(next);
    setMessage(announce ?? summary(next));
    const first = Object.keys(next)[0];
    if (first) {
      // After React renders the error text, so it's read with the field.
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(fieldIdFor(first))}`)?.focus();
      });
    }
  };

  // Little things ------------------------------------------------------------------
  // The draft's emoji follows what's typed (coffee → ☕) until someone picks one.
  const [draftEmoji, setDraftEmoji] = React.useState(DEFAULT_EMOJI);
  const [emojiPicked, setEmojiPicked] = React.useState(false);
  type Thing = PersonFormValues["littleThings"][number];
  const addThing = (): Thing[] => {
    const t = thingDraft.trim();
    if (!t) return values.littleThings;
    if (values.littleThings.length >= LITTLE_THINGS_LIMIT) {
      showErrors({ littleThings: `Up to ${LITTLE_THINGS_LIMIT} little things.` });
      return values.littleThings;
    }
    setThingDraft("");
    setDraftEmoji(DEFAULT_EMOJI);
    setEmojiPicked(false);
    clearError("littleThings");
    if (values.littleThings.some((x) => x.text.toLocaleLowerCase() === t.toLocaleLowerCase())) {
      return values.littleThings;
    }
    const next = [...values.littleThings, { text: t, emoji: draftEmoji }];
    update({ littleThings: next });
    return next;
  };
  const setThingEmoji = (i: number, emoji: string) =>
    update({
      littleThings: values.littleThings.map((x, j) => (j === i ? { ...x, emoji } : x)),
    });

  // Other days -----------------------------------------------------------------------
  const setDay = (i: number, patch: Partial<OtherDayValues>) => {
    update({ days: values.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
    clearError(...Object.keys(patch).map((k) => `days.${i}.${k}`));
  };
  const addDay = () => {
    update({
      days: [
        ...values.days,
        {
          id: null,
          kind: "anniversary",
          title: "",
          recurring: OCCASION_TYPES.anniversary.defaultRecurring,
          day: null,
          month: null,
          year: null,
        },
      ],
    });
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>(`#pf-day-${values.days.length}-kind`)?.focus(),
    );
  };
  const removeDay = (i: number) => {
    update({ days: values.days.filter((_, j) => j !== i) });
    // Error keys after this row shift; simplest is to clear the days' errors.
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("days."))));
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>("#pf-add-day")?.focus(),
    );
  };

  // Save and remove -------------------------------------------------------------------
  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    // A little thing still in the box counts.
    const input = { ...values, littleThings: thingDraft.trim() ? addThing() : values.littleThings };
    const parsed = personFormSchema.safeParse(input);
    if (!parsed.success) {
      showErrors(personFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setMessage("Saving…");
    startTransition(async () => {
      const result = await savePerson(parsed.data);
      if (!result.ok) {
        showErrors(result.fieldErrors ?? {}, result.message);
        return;
      }
      setMessage("");
      onDone({ kind: "saved", id: result.id, name: result.name, added: !editing });
    });
  };

  const onRemove = () => {
    if (!initial.id || pending) return;
    const id = initial.id;
    startTransition(async () => {
      const result = await removePerson(id);
      if (!result.ok) {
        setConfirmRemove(false);
        setMessage(result.message);
        return;
      }
      onDone({ kind: "removed", id, name: initial.name.trim() });
    });
  };

  const name = values.name.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-w-xl gap-6" onCloseAutoFocus={onCloseAutoFocus}>
        {confirmRemove ? (
          <>
            <DialogHeader>
              <DialogTitle className="[overflow-wrap:anywhere]">
                Remove {initial.name.trim()}?
              </DialogTitle>
              <DialogDescription>
                They&apos;ll be hidden from your people and their reminders stop. You can undo right
                after.
              </DialogDescription>
            </DialogHeader>
            <p aria-live="polite" className="text-13 font-semibold text-accent-text empty:hidden">
              {message}
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="card2"
                onClick={() => setConfirmRemove(false)}
                disabled={pending}
                autoFocus
              >
                Keep them
              </Button>
              <Button onClick={onRemove} aria-disabled={pending || undefined}>
                <Trash2Icon aria-hidden /> {pending ? "Removing…" : "Remove"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit person" : "Add someone"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Change their details, days and little things."
                  : "Their name and birthday are enough. The rest can wait."}
              </DialogDescription>
            </DialogHeader>

            <form ref={formRef} noValidate onSubmit={onSubmit} className="grid gap-5">
              <Field
                id="pf-name"
                label="Their name"
                placeholder="e.g. Sara"
                autoComplete="off"
                maxLength={NAME_MAX}
                value={values.name}
                onChange={(e) => {
                  update({ name: e.currentTarget.value });
                  clearError("name");
                }}
                error={errors.name}
              />

              <div className="grid gap-2">
                <span id="pf-relation-label" className="text-14 font-semibold">
                  Who are they to you?
                </span>
                <RelationChips
                  labelId="pf-relation-label"
                  value={values.relationKind}
                  onChange={(relationKind) =>
                    update({
                      relationKind,
                      ...(colorPicked ? {} : { color: RELATION_COLORS[relationKind] }),
                    })
                  }
                />
              </div>

              <Field
                id="pf-description"
                label="How you'd describe them (optional)"
                placeholder="e.g. Little sister"
                autoComplete="off"
                maxLength={DESCRIPTION_MAX}
                value={values.description}
                onChange={(e) => {
                  update({ description: e.currentTarget.value });
                  clearError("description");
                }}
                error={errors.description}
              />

              <div className="grid gap-2">
                <span id="pf-color-label" className="text-14 font-semibold">
                  Their colour
                </span>
                <ColorSwatches
                  labelId="pf-color-label"
                  surface="card"
                  value={values.color}
                  onChange={(color) => {
                    setColorPicked(true);
                    update({ color });
                  }}
                />
              </div>

              <DateFields
                idPrefix="pf-bday"
                legend="Their birthday"
                value={values}
                onChange={(patch) => {
                  update(patch);
                  clearError(...Object.keys(patch));
                }}
                errors={{ day: errors.day, month: errors.month, year: errors.year }}
              />

              <fieldset className="grid gap-3">
                <legend className="mb-1 text-14 font-semibold">Other days (optional)</legend>
                {values.days.map((d, i) => (
                  <OtherDayRow
                    key={d.id ?? `new-${i}`}
                    index={i}
                    value={d}
                    errors={errors}
                    onChange={(patch) => setDay(i, patch)}
                    onRemove={() => removeDay(i)}
                  />
                ))}
                {values.days.length < OTHER_DAYS_LIMIT && (
                  <Button
                    id="pf-add-day"
                    type="button"
                    variant="card2"
                    onClick={addDay}
                    className="w-fit"
                  >
                    <PlusIcon aria-hidden />{" "}
                    {values.days.length ? "Add another day" : "Add an anniversary or another day"}
                  </Button>
                )}
              </fieldset>

              <div className="grid gap-1.5">
                <label htmlFor="pf-little" className="text-14 font-semibold">
                  Little things they love (optional)
                </label>
                <div className="flex gap-2">
                  <EmojiPicker
                    value={draftEmoji}
                    label={thingDraft.trim() || "this little thing"}
                    className="h-[52px] w-[52px]"
                    onChange={(emoji) => {
                      setDraftEmoji(emoji);
                      setEmojiPicked(true);
                    }}
                  />
                  <input
                    id="pf-little"
                    autoComplete="off"
                    placeholder="e.g. black coffee"
                    maxLength={LITTLE_THING_MAX}
                    value={thingDraft}
                    aria-invalid={errors.littleThings ? true : undefined}
                    aria-describedby="pf-little-note"
                    onChange={(e) => {
                      const text = e.currentTarget.value;
                      setThingDraft(text);
                      clearError("littleThings");
                      // Suggest only: never over a hand-picked emoji.
                      if (!emojiPicked) setDraftEmoji(suggestEmoji(text) ?? DEFAULT_EMOJI);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addThing();
                      }
                    }}
                    className={cn(fieldInputClass, "min-w-0 flex-1")}
                  />
                  <Button type="button" variant="card2" onClick={addThing} className="h-[52px]">
                    Add
                  </Button>
                </div>
                <FieldNote id="pf-little-note" error={Boolean(errors.littleThings)}>
                  {errors.littleThings ??
                    `Press Enter to add each one. Up to ${LITTLE_THINGS_LIMIT}.`}
                </FieldNote>
                {values.littleThings.length > 0 && (
                  <ul aria-label="Their little things" className="flex flex-wrap gap-1.5 pt-1">
                    {values.littleThings.map((t, i) => (
                      <li
                        key={t.text}
                        className={cn(
                          "inline-flex max-w-full min-w-0 items-center gap-1 rounded-pill py-1 pr-1 pl-1 text-13 font-semibold",
                          pastelClasses[values.color],
                        )}
                      >
                        <EmojiPicker
                          value={t.emoji ?? DEFAULT_EMOJI}
                          label={t.text}
                          onChange={(emoji) => setThingEmoji(i, emoji)}
                          className="-my-2 size-11 rounded-pill bg-transparent text-[18px]"
                        />
                        <span className="min-w-0 [overflow-wrap:anywhere]">{t.text}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${t.text}`}
                          onClick={() => {
                            update({
                              littleThings: values.littleThings.filter((x) => x.text !== t.text),
                            });
                            requestAnimationFrame(() =>
                              formRef.current?.querySelector<HTMLElement>("#pf-little")?.focus(),
                            );
                          }}
                          className="-my-2.5 grid size-11 shrink-0 cursor-pointer place-items-center rounded-pill hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)]"
                        >
                          <XIcon aria-hidden className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-5">
                <p
                  id="pf-message"
                  aria-live="polite"
                  className="min-w-[min(100%,12rem)] flex-1 text-13 font-semibold text-accent-text"
                >
                  {message}
                </p>
                {editing && (
                  <Button
                    type="button"
                    variant="transparent"
                    onClick={() => {
                      setMessage("");
                      setConfirmRemove(true);
                    }}
                    disabled={pending}
                    className="text-accent-text"
                  >
                    Remove
                  </Button>
                )}
                <Button type="submit" aria-disabled={pending || undefined}>
                  {pending
                    ? "Saving…"
                    : editing
                      ? "Save"
                      : name
                        ? `Add ${truncateForButton(name)}`
                        : "Add person"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Keep the button short: "Add Sara", or "Add them" for long names. */
const truncateForButton = (name: string) => (name.length > 14 ? "them" : name);

function OtherDayRow({
  index,
  value,
  errors,
  onChange,
  onRemove,
}: {
  index: number;
  value: OtherDayValues;
  errors: Errors;
  onChange: (patch: Partial<OtherDayValues>) => void;
  onRemove: () => void;
}) {
  const key = (f: string) => errors[`days.${index}.${f}`];
  const type = occasionType(value.kind);
  const id = (f: string) => `pf-day-${index}-${f}`;
  const titleRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-3 rounded-[20px] bg-card2 p-4">
      <div className="flex items-end gap-2">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <label htmlFor={id("kind")} className="text-14 font-semibold">
            Kind of day
          </label>
          <SelectField
            id={id("kind")}
            value={value.kind}
            onChange={(e) => {
              const kind = e.currentTarget.value as OtherDayKind;
              // A new type brings its own repeat default, unless the person chose one.
              onChange({
                kind,
                ...(value.repeatChosen ? {} : { recurring: OCCASION_TYPES[kind].defaultRecurring }),
              });
            }}
          >
            {OTHER_DAY_KINDS.map((k) => (
              <option key={k} value={k}>
                {OCCASION_TYPES[k].label}
              </option>
            ))}
          </SelectField>
        </div>
        <Button
          type="button"
          variant="transparent"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove this ${type.label.toLocaleLowerCase()}`}
          className="mb-1 shrink-0 text-sub hover:text-text"
        >
          <Trash2Icon aria-hidden />
        </Button>
      </div>

      <div className="grid gap-2">
        <Field
          ref={titleRef}
          id={id("title")}
          label={type.titleRequired ? "What's the day called?" : "Title (optional)"}
          placeholder={type.placeholder}
          autoComplete="off"
          maxLength={DAY_TITLE_MAX}
          value={value.title}
          onChange={(e) => onChange({ title: e.currentTarget.value })}
          error={key("title")}
        />
        {type.chips.length > 0 && (
          <div role="group" aria-label="Suggestions" className="flex flex-wrap gap-1.5">
            {type.chips.map((chip) => (
              <button
                key={chip.title}
                type="button"
                aria-pressed={value.title.trim() === chip.title}
                onClick={() => {
                  // Fill the title (still editable) and, unless the person
                  // chose a repeat, use the chip's.
                  onChange({
                    title: chip.title,
                    ...(value.repeatChosen ? {} : { recurring: chip.recurring }),
                  });
                  requestAnimationFrame(() => titleRef.current?.focus());
                }}
                className={cn(
                  "min-h-11 cursor-pointer rounded-pill hover-tint px-3.5 text-14 font-semibold transition-colors duration-200 ease-soft",
                  value.title.trim() === chip.title ? "bg-text text-bg" : "bg-card text-text",
                )}
              >
                {chip.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <span id={id("repeat-label")} className="text-14 font-semibold">
          Repeats
        </span>
        <ChoiceGroup
          aria-labelledby={id("repeat-label")}
          value={value.recurring ? "yearly" : "once"}
          onValueChange={(v) => onChange({ recurring: v === "yearly", repeatChosen: true })}
          className="w-fit gap-1 rounded-pill bg-card p-1"
        >
          {(
            [
              ["once", "Once"],
              ["yearly", "Every year"],
            ] as const
          ).map(([v, label]) => (
            <ChoiceItem
              key={v}
              value={v}
              className="min-h-11 rounded-pill px-4 text-15 font-semibold text-text data-[state=checked]:bg-text data-[state=checked]:text-bg"
            >
              {label}
            </ChoiceItem>
          ))}
        </ChoiceGroup>
      </div>

      <DateFields
        idPrefix={`pf-day-${index}`}
        legend="Date"
        hint={
          !value.recurring
            ? "It happens once, so it needs the year."
            : type.countsYears
              ? "Add the year to count the years."
              : undefined
        }
        value={value}
        onChange={onChange}
        errors={{ day: key("day"), month: key("month"), year: key("year") }}
      />
    </div>
  );
}
