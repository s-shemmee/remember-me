import {
  type CalendarDate,
  countdownLabel,
  daysBetween,
  formatLongDate,
  formatShortDate,
  nextOccurrence,
  toIsoDate,
  yearsOn,
} from "@/lib/dates";
import { type LittleThing, littleThingsOf } from "./little-emoji";
import { type Pastel, pastels } from "@/styles/tokens";

import { type OccasionKind, type OtherDayKind, typeFor } from "@/features/occasions/types";

import { isRelation, type Relation, RELATION_COLORS } from "./constants";
import type { PersonFormValues } from "./schema";
import type { Look } from "./looks";

/**
 * Turns people rows into what the People screen shows: days sorted by how
 * soon they come, with countdowns worked out from "today" in the user's
 * timezone. Pure, so it's unit-tested without a database.
 */

export type OccasionRow = {
  id: string;
  kind: OccasionKind;
  title: string | null;
  day: number;
  month: number;
  year: number | null;
  /** Every year, or once on day/month/year. */
  recurring: boolean;
};

export type PersonRow = {
  id: string;
  name: string;
  relation: string | null;
  relation_kind: string | null;
  color: string;
  group: "family" | "friends" | "work" | "other";
  little_things: string[];
  /** One per little thing, same order (a heart when missing). */
  little_thing_emojis?: string[] | null;
  /** Set when they're one of your connections ("This is Khalid"). */
  linked_profile_id?: string | null;
  in_memory?: boolean;
  occasions: OccasionRow[];
};

export type DayView = {
  id: string;
  kind: OccasionRow["kind"];
  emoji: string;
  /** Short name for the card pill: "Birthday", "Anniversary", or the title. */
  label: string;
  /** Full title for the profile: "Birthday, turns 30", "Anniversary, 32 years". */
  title: string;
  /** Remembrance: shown quietly (no confetti, excitement or gift actions). */
  gentle: boolean;
  /** "Fri, 6 November". */
  date: string;
  /** "in 2 days", "today", "in 4 months". */
  when: string;
  daysUntil: number;
  /** The occurrence shown ("2026-11-06"): the one a plan belongs to. */
  occursOn: string;
  /** "Fri, 6 Nov". */
  shortDate: string;
};

export type PersonView = {
  id: string;
  /** Their account's photo or character, when connected (see looks.ts). */
  look?: Look | null;
  name: string;
  /** What to show under their name: their description, else the chip. */
  relationLabel: string;
  /** Linked to one of your connections. */
  connected: boolean;
  /** Has passed: every day is shown gently (people.in_memory). */
  inMemory: boolean;
  color: Pastel;
  group: PersonRow["group"];
  littleThings: LittleThing[];
  days: DayView[];
  next: DayView | null;
  /** The edit form, filled in. */
  form: PersonFormValues;
};

export const asPastel = (c: string | null | undefined): Pastel =>
  pastels.includes(c as Pastel) ? (c as Pastel) : "lilac";

export function dayView(o: OccasionRow, today: CalendarDate, inMemory = false): DayView {
  const type = typeFor(o.kind, inMemory);
  // Once: on its date in its year. Yearly: the next time it comes round.
  const oneOff = !o.recurring && o.year !== null;
  const on = oneOff ? { year: o.year!, month: o.month, day: o.day } : nextOccurrence(o, today);
  const years = oneOff ? null : yearsOn(o.year, on);
  const daysUntil = daysBetween(today, on);
  const passed = daysUntil < 0;
  // On their own profile the name is implied: "Wedding", "Anniversary".
  const label = o.title?.trim() || type.label;
  const title =
    o.kind === "birthday" && years && !inMemory
      ? `Birthday, turns ${years}`
      : type.countsYears && years
        ? `${label}, ${years} ${years === 1 ? "year" : "years"}`
        : label;
  return {
    id: o.id,
    kind: o.kind,
    emoji: type.emoji,
    label,
    title,
    gentle: type.gentle,
    date: passed ? `${formatLongDate(on)} ${on.year}` : formatLongDate(on),
    when: passed ? "passed" : countdownLabel(daysUntil),
    // Passed one-off days sort last and are never "next".
    daysUntil: passed ? Number.POSITIVE_INFINITY : daysUntil,
    occursOn: toIsoDate(on),
    shortDate: formatShortDate(on),
  };
}

export function personView(row: PersonRow, today: CalendarDate): PersonView {
  const relationKind: Relation = isRelation(row.relation_kind) ? row.relation_kind : "Friend";
  const days = row.occasions
    .map((o) => dayView(o, today, Boolean(row.in_memory)))
    // Soonest first; the birthday wins a tie.
    .sort(
      (a, b) =>
        a.daysUntil - b.daysUntil || Number(b.kind === "birthday") - Number(a.kind === "birthday"),
    );
  const birthday = row.occasions.find((o) => o.kind === "birthday");
  return {
    id: row.id,
    name: row.name,
    relationLabel: row.relation?.trim() || row.relation_kind || "",
    color: asPastel(row.color ?? RELATION_COLORS[relationKind]),
    group: row.group,
    littleThings: littleThingsOf(row.little_things, row.little_thing_emojis),
    connected: Boolean(row.linked_profile_id),
    inMemory: Boolean(row.in_memory),
    days,
    next: days.find((d) => Number.isFinite(d.daysUntil)) ?? null,
    form: {
      id: row.id,
      name: row.name,
      relationKind,
      description: row.relation ?? "",
      color: asPastel(row.color),
      day: birthday?.day ?? null,
      month: birthday?.month ?? null,
      year: birthday?.year ?? null,
      littleThings: littleThingsOf(row.little_things, row.little_thing_emojis),
      days: row.occasions
        .filter((o) => o.kind !== "birthday")
        .map((o) => ({
          id: o.id,
          kind: o.kind as OtherDayKind,
          recurring: o.recurring,
          title: o.title ?? "",
          day: o.day,
          month: o.month,
          year: o.year,
        })),
    },
  };
}

/** People sorted by their next day (people with no days go last, by name). */
export function peopleView(rows: PersonRow[], today: CalendarDate): PersonView[] {
  return rows
    .map((r) => personView(r, today))
    .sort(
      (a, b) =>
        (a.next?.daysUntil ?? Infinity) - (b.next?.daysUntil ?? Infinity) ||
        a.name.localeCompare(b.name),
    );
}

/** Search (by name) and filter (by group), as on the People screen. */
export function filterPeople(people: PersonView[], filter: string, query: string): PersonView[] {
  const q = query.trim().toLocaleLowerCase();
  return people.filter(
    (p) =>
      (filter === "all" || (filter === "connected" ? p.connected : p.group === filter)) &&
      (!q || p.name.toLocaleLowerCase().includes(q)),
  );
}
