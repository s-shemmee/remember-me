"use client";

import { DicesIcon } from "lucide-react";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, ChoiceItem } from "@/components/ui/choice-group";
import { pastelClasses } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { TruncatedName } from "@/components/ui/truncated-name";
import { ColorSwatches } from "@/features/people/components/color-swatches";
import { heartInk, RelationChips } from "@/features/people/components/relation-chips";
import { DESCRIPTION_MAX, LITTLE_THING_MAX } from "@/features/people/constants";
import { cn } from "@/lib/utils";

import {
  CHARACTERS,
  characterEmoji,
  MONTHS,
  NAME_MAX,
  PASTELS,
  RELATION_COLORS,
  REMINDER_OPTIONS,
} from "../constants";
import { sampleNudge } from "../noor-lines";
import type { OnboardingDraft } from "../store";
import { DateFields } from "@/components/ui/date-fields";

type Errors = Record<string, string>;

/** "First, *you*": the step heading with one serif accent word. */
export function StepHeading({
  children,
  accent,
  after,
  lead,
}: {
  children: React.ReactNode;
  accent: string;
  /** Text after the accent word ("When should I *nudge* you?"). */
  after?: string;
  lead: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <h1
        tabIndex={-1}
        className="text-34 leading-[1.1] font-extrabold tracking-heading outline-none sm:text-44"
      >
        {children} <em className="font-serif font-normal text-accent-text">{accent}</em>
        {after ? ` ${after}` : null}
      </h1>
      <p className="text-17 leading-[1.55] text-sub">{lead}</p>
    </div>
  );
}

// 1 · You ---------------------------------------------------------------------

export function StepYou({
  value,
  onChange,
  errors,
}: {
  value: OnboardingDraft["you"];
  onChange: (patch: Partial<OnboardingDraft["you"]>) => void;
  errors: Errors;
}) {
  return (
    <>
      <StepHeading accent="you" lead="Your day matters too. When is it?">
        First,
      </StepHeading>
      <Field
        id="you-first-name"
        label="Your first name"
        autoComplete="given-name"
        value={value.firstName}
        maxLength={NAME_MAX}
        onChange={(e) => onChange({ firstName: e.currentTarget.value })}
        error={errors.firstName}
      />
      <DateFields
        idPrefix="you-bday"
        legend="Your birthday"
        hint="Just the day and month. Your year stays private."
        value={value}
        onChange={onChange}
        errors={errors}
      />
    </>
  );
}

// 2 · Your look ---------------------------------------------------------------

/** Desktop preview in Noor's column: "How your people see you". */
export function YouPreview({
  look,
  firstName,
}: {
  look: OnboardingDraft["look"];
  firstName: string;
}) {
  const name = firstName.trim() || "You";
  return (
    <div
      aria-hidden
      className="flex flex-col items-center gap-2.5 rounded-[24px] bg-card p-[22px] shadow-card"
    >
      <span className="text-12 font-bold tracking-[.05em] text-sub">HOW YOUR PEOPLE SEE YOU</span>
      <Avatar
        name={name}
        pastel={look.color}
        character={look.kind === "character" ? characterEmoji(look.character) : null}
        decorative
        className={cn("size-[120px]", look.kind === "character" ? "text-[52px]" : "text-[42px]")}
      />
      <span className="max-w-full truncate text-17 font-bold">{name}</span>
    </div>
  );
}

export function StepLook({
  value,
  firstName,
  onChange,
  errors,
}: {
  value: OnboardingDraft["look"];
  firstName: string;
  onChange: (patch: Partial<OnboardingDraft["look"]>) => void;
  errors: Errors;
}) {
  // Type, colour and character all change, as in the screen.
  const shuffle = () => {
    const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;
    onChange({
      kind: Math.random() < 0.5 ? "initials" : "character",
      color: pick(PASTELS),
      character: pick(CHARACTERS).key,
    });
  };

  return (
    <>
      <StepHeading accent="look" lead="This is how your people will see you. Change it anytime.">
        Your
      </StepHeading>

      <div className="flex flex-wrap items-center gap-5">
        {/* Below 1024px the preview stays here; on desktop it's in Noor's column. */}
        <Avatar
          name={firstName || "You"}
          pastel={value.color}
          character={value.kind === "character" ? characterEmoji(value.character) : null}
          size="xl"
          decorative
          className="lg:hidden"
        />
        <ChoiceGroup
          aria-label="Avatar type"
          value={value.kind}
          onValueChange={(kind) =>
            onChange({
              kind: kind as "initials" | "character",
              character:
                kind === "character" ? (value.character ?? CHARACTERS[0].key) : value.character,
            })
          }
          className="inline-flex w-fit gap-1 rounded-pill bg-card2 p-1"
        >
          {(["initials", "character"] as const).map((k) => (
            <ChoiceItem
              key={k}
              value={k}
              className="min-h-11 rounded-pill px-4 text-15 font-semibold text-text data-[state=checked]:bg-card data-[state=checked]:shadow-card"
            >
              {k === "initials" ? "Initials" : "Character"}
            </ChoiceItem>
          ))}
        </ChoiceGroup>
      </div>

      {value.kind === "character" && (
        <div className="grid gap-2">
          <span id="look-character-label" className="text-14 font-semibold">
            Character
          </span>
          <ChoiceGroup
            aria-labelledby="look-character-label"
            aria-describedby={errors.character ? "look-character-error" : undefined}
            value={value.character ?? ""}
            onValueChange={(character) => onChange({ character: character as never })}
            className="grid max-w-[462px] grid-cols-4 gap-2.5"
          >
            {CHARACTERS.map((c, i) => (
              <ChoiceItem
                key={c.key}
                id={i === 0 ? "look-character-first" : undefined}
                value={c.key}
                className="flex aspect-square min-w-0 flex-col items-center justify-center gap-1.5 rounded-[18px] bg-card2 text-13 font-semibold text-sub hover:-translate-y-px data-[state=checked]:text-text data-[state=checked]:ring-3 data-[state=checked]:ring-accent motion-reduce:hover:translate-y-0"
              >
                <span aria-hidden className="text-[clamp(2rem,9vw,2.75rem)] leading-none">
                  {c.emoji}
                </span>
                <span className="max-w-full truncate px-1">{c.label}</span>
              </ChoiceItem>
            ))}
          </ChoiceGroup>
          {errors.character && (
            <p id="look-character-error" className="text-13 font-semibold text-accent-text">
              <span className="sr-only">Error:</span> {errors.character}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-2">
        <span id="look-colour-label" className="text-14 font-semibold">
          Colour
        </span>
        <ColorSwatches
          labelId="look-colour-label"
          value={value.color}
          onChange={(color) => onChange({ color })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3.5">
        <Button variant="card2" onClick={shuffle} className="w-fit">
          <DicesIcon aria-hidden /> Shuffle
        </Button>
        <span className="text-13 text-sub">
          <span aria-hidden>📷 </span>Want a photo instead? Add one later from your profile.
        </span>
      </div>
    </>
  );
}

// 3 · First person --------------------------------------------------------------

/** The person card, in their relation's colour. Decorative: it repeats the form. */
export function PersonPreview({
  person,
  className,
}: {
  person: OnboardingDraft["person"];
  className?: string;
}) {
  const color = RELATION_COLORS[person.relation];
  const name = person.name.trim();
  const littleThing = person.littleThing.trim();
  const date = person.day && person.month ? `${person.day} ${MONTHS[person.month - 1]}` : null;
  return (
    <div
      aria-hidden
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-[24px] bg-card p-5 shadow-card",
        className,
      )}
    >
      <span className="text-12 font-bold tracking-[.05em] text-sub">PREVIEW</span>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar
          name={name || "?"}
          pastel={color}
          decorative
          className="size-14 shrink-0 text-[18px]"
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[18px] font-bold">{name || "Their name"}</span>
          <span className="truncate text-14 text-sub">
            {person.description.trim() || person.relation}
          </span>
        </span>
      </div>
      <span
        className={cn(
          "self-start rounded-pill px-3 py-1.5 text-13 font-bold",
          pastelClasses[color],
        )}
      >
        🎂 {date ?? "pick a date"}
      </span>
      {littleThing && (
        <span className="flex min-w-0 items-center gap-2 rounded-[14px] bg-card2 px-3 py-2 text-13">
          <svg viewBox="0 0 24 24" className={cn("size-3.5 shrink-0", heartInk[color])}>
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
          </svg>
          <span className="min-w-0 [overflow-wrap:anywhere]">Loves {littleThing}</span>
        </span>
      )}
    </div>
  );
}

export function StepPerson({
  value,
  onChange,
  onNameCommit,
  errors,
}: {
  value: OnboardingDraft["person"];
  onChange: (patch: Partial<OnboardingDraft["person"]>) => void;
  /** Called on blur, so Noor (aria-live) reacts once, not on every keystroke. */
  onNameCommit: (name: string) => void;
  errors: Errors;
}) {
  return (
    <>
      <StepHeading accent="person" lead="Who's the first name that comes to mind?">
        Your first
      </StepHeading>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Field
            id="person-name"
            label="Their name"
            placeholder="e.g. Sara"
            autoComplete="off"
            maxLength={NAME_MAX}
            value={value.name}
            onChange={(e) => onChange({ name: e.currentTarget.value })}
            onBlur={(e) => onNameCommit(e.currentTarget.value.trim())}
            error={errors.name}
          />
          <div className="grid gap-2">
            <span id="person-relation-label" className="text-14 font-semibold">
              Who are they to you?
            </span>
            <RelationChips
              labelId="person-relation-label"
              value={value.relation}
              onChange={(relation) => onChange({ relation })}
            />
          </div>
          <Field
            id="person-description"
            label="How you'd describe them (optional)"
            placeholder="e.g. Little sister"
            autoComplete="off"
            maxLength={DESCRIPTION_MAX}
            value={value.description}
            onChange={(e) => onChange({ description: e.currentTarget.value })}
            error={errors.description}
          />
          <DateFields
            idPrefix="person-bday"
            legend="Their birthday"
            value={value}
            onChange={onChange}
            errors={errors}
          />
          <Field
            id="person-little-thing"
            label="A little thing they love (optional)"
            placeholder="e.g. sunflowers, black coffee"
            autoComplete="off"
            maxLength={LITTLE_THING_MAX}
            value={value.littleThing}
            onChange={(e) => onChange({ littleThing: e.currentTarget.value })}
            error={errors.littleThing}
          />
        </div>
        {/* Below 1024px the preview stays here; on desktop it's in Noor's column. */}
        <PersonPreview person={value} className="w-full sm:max-w-[240px] lg:hidden" />
      </div>
    </>
  );
}

// 4 · Reminders -----------------------------------------------------------------

export function StepReminders({
  value,
  onChange,
  errors,
}: {
  value: OnboardingDraft["reminders"];
  onChange: (patch: Partial<OnboardingDraft["reminders"]>) => void;
  errors: Errors;
}) {
  const toggle = (days: number) => {
    const on = value.offsets.includes(days);
    onChange({
      offsets: on
        ? value.offsets.filter((d) => d !== days)
        : [...value.offsets, days].sort((a, b) => b - a),
    });
  };

  return (
    <>
      <StepHeading accent="nudge" after="you?" lead="I picked my favourites. Tap to change.">
        When should I
      </StepHeading>

      <div className="grid gap-2">
        <span id="reminders-when-label" className="text-14 font-semibold">
          Before each day
        </span>
        <div
          role="group"
          aria-labelledby="reminders-when-label"
          aria-describedby={errors.offsets ? "reminders-when-error" : undefined}
          className="flex flex-wrap gap-2"
        >
          {REMINDER_OPTIONS.map((o, i) => (
            <button
              key={o.days}
              id={i === 0 ? "reminder-first" : undefined}
              type="button"
              aria-pressed={value.offsets.includes(o.days)}
              onClick={() => toggle(o.days)}
              className="hover-tint inline-flex min-h-11 cursor-pointer items-center rounded-pill bg-card2 px-4 text-15 font-semibold text-text transition-colors duration-200 ease-soft aria-pressed:bg-text aria-pressed:text-bg"
            >
              {o.label}
            </button>
          ))}
        </div>
        {errors.offsets && (
          <p id="reminders-when-error" className="text-13 font-semibold text-accent-text">
            <span className="sr-only">Error:</span> {errors.offsets}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <span className="text-14 font-semibold">How</span>
        <div className="grid gap-3 sm:grid-cols-2">
          <HowCard
            id="reminders-email"
            emoji="📧"
            title="Email"
            line="A short note in your inbox"
            checked={value.email}
            onCheckedChange={(email) => onChange({ email })}
          />
          <HowCard
            id="reminders-push"
            emoji="🔔"
            title="Notifications"
            line="On this device, like a message"
            checked={value.push}
            onCheckedChange={(push) => onChange({ push })}
            note={
              value.push ? "We'll ask your browser later, when notifications are ready." : undefined
            }
          />
        </div>
      </div>
    </>
  );
}

function HowCard({
  id,
  emoji,
  title,
  line,
  checked,
  onCheckedChange,
  note,
}: {
  id: string;
  emoji: string;
  title: string;
  line: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card bg-card p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-22">
          {emoji}
        </span>
        <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col">
          <span className="text-15 font-semibold">{title}</span>
          <span className="text-13 text-sub">{line}</span>
        </label>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-describedby={note ? `${id}-note` : undefined}
        />
      </div>
      <p id={`${id}-note`} aria-live="polite" className="text-13 text-sub empty:hidden">
        {note}
      </p>
    </div>
  );
}

/** Desktop preview in Noor's column: what a reminder will look like. */
export function NotificationPreview({
  personName,
  offsets,
}: {
  personName: string | null;
  offsets: readonly number[];
}) {
  return (
    <figure className="flex gap-3 rounded-[22px] bg-[color-mix(in_srgb,var(--card)_80%,transparent)] px-4 py-3.5 font-system shadow-card">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-peach text-22"
      >
        🎂
      </span>
      <figcaption className="flex min-w-0 flex-col gap-0.5">
        <span className="text-12 font-semibold tracking-[.04em] text-sub">
          <span className="sr-only">Sample reminder: </span>REMEMBER ME · 9:00
        </span>
        <span className="text-15 font-bold [overflow-wrap:anywhere]">
          {sampleNudge(personName, offsets)}
        </span>
      </figcaption>
    </figure>
  );
}

// Done --------------------------------------------------------------------------

export function StepDone({
  firstName,
  personName,
}: {
  firstName: string;
  personName: string | null;
}) {
  const name = firstName.trim();
  return (
    <div className="flex flex-1 flex-col justify-center gap-5 py-6">
      <span aria-hidden className="text-[56px] leading-none">
        🎉
      </span>
      <h1
        tabIndex={-1}
        className="max-w-full text-34 leading-[1.1] font-extrabold tracking-heading outline-none sm:text-44"
      >
        You&apos;re all <em className="font-serif font-normal text-accent-text">set</em>
        {name ? (
          <>
            , <TruncatedName>{name}</TruncatedName>
          </>
        ) : null}
      </h1>
      <p className="max-w-[460px] text-17 [overflow-wrap:anywhere] text-sub">
        {personName
          ? `${personName} is saved, and I'll nudge you before their day. Your own day is on the calendar too ✨`
          : "Your day is on the calendar. Add your people whenever you're ready ✨"}
      </p>
      <span className="-rotate-2 font-hand text-[1.1rem] text-sub">
        tip: add the app to your home screen 📱
      </span>
    </div>
  );
}
