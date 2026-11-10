import {
  type CalendarDate,
  countdownLabel,
  daysBetween,
  formatLongDate,
  nextOccurrence,
  yearsOn,
} from "@/lib/dates";
import { type Pastel, pastels } from "@/styles/tokens";

import { DAY_KINDS, isRelation, type Relation, RELATION_COLORS } from "./constants";
import type { PersonFormValues } from "./schema";

/**
 * Turns people rows into what the People screen shows: days sorted by how
 * soon they come, with countdowns worked out from "today" in the user's
 * timezone. Pure, so it's unit-tested without a database.
 */

export type OccasionRow = {
  id: string;
  kind: "birthday" | "anniversary" | "graduation" | "other";
  title: string | null;
  day: number;
  month: number;
  year: number | null;
};

export type PersonRow = {
  id: string;
  name: string;
  relation: string | null;
  relation_kind: string | null;
  color: string;
  group: "family" | "friends" | "work" | "other";
  little_things: string[];
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
  /** "Fri, 6 November". */
  date: string;
  /** "in 2 days", "today", "in 4 months". */
  when: string;
  daysUntil: number;
};

export type PersonView = {
  id: string;
  name: string;
  /** What to show under their name: their description, else the chip. */
  relationLabel: string;
  color: Pastel;
  group: PersonRow["group"];
  littleThings: string[];
  days: DayView[];
  next: DayView | null;
  /** The edit form, filled in. */
  form: PersonFormValues;
};

export const asPastel = (c: string | null | undefined): Pastel =>
  pastels.includes(c as Pastel) ? (c as Pastel) : "lilac";

const EMOJI: Record<OccasionRow["kind"], string> = {
  birthday: "🎂",
  anniversary: DAY_KINDS[0].emoji,
  graduation: DAY_KINDS[1].emoji,
  other: DAY_KINDS[2].emoji,
};

export function dayView(o: OccasionRow, today: CalendarDate): DayView {
  const on = nextOccurrence(o, today);
  const years = yearsOn(o.year, on);
  const daysUntil = daysBetween(today, on);
  const label =
    o.kind === "birthday"
      ? "Birthday"
      : o.kind === "anniversary"
        ? "Anniversary"
        : o.kind === "graduation"
          ? "Graduation"
          : o.title?.trim() || "A special day";
  const title =
    o.kind === "birthday" && years
      ? `Birthday, turns ${years}`
      : o.kind === "anniversary" && years
        ? `Anniversary, ${years} ${years === 1 ? "year" : "years"}`
        : label;
  return {
    id: o.id,
    kind: o.kind,
    emoji: EMOJI[o.kind],
    label,
    title,
    date: formatLongDate(on),
    when: countdownLabel(daysUntil),
    daysUntil,
  };
}

export function personView(row: PersonRow, today: CalendarDate): PersonView {
  const relationKind: Relation = isRelation(row.relation_kind) ? row.relation_kind : "Friend";
  const days = row.occasions
    .map((o) => dayView(o, today))
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
    littleThings: row.little_things,
    days,
    next: days[0] ?? null,
    form: {
      id: row.id,
      name: row.name,
      relationKind,
      description: row.relation ?? "",
      color: asPastel(row.color),
      day: birthday?.day ?? null,
      month: birthday?.month ?? null,
      year: birthday?.year ?? null,
      littleThings: row.little_things,
      days: row.occasions
        .filter((o) => o.kind !== "birthday")
        .map((o) => ({
          id: o.id,
          kind: o.kind as "anniversary" | "graduation" | "other",
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
      (filter === "all" || p.group === filter) && (!q || p.name.toLocaleLowerCase().includes(q)),
  );
}
