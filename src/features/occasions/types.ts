/**
 * Occasion types: the one place that knows each kind's name, emoji, title
 * suggestions and repeat default.
 * People, Home and Calendar all read from here.
 *
 * There is deliberately no health type: health milestones go under
 * Something else, in the user's own words, so health details never end up
 * in reminder emails or notifications.
 */

export type OccasionKind =
  "birthday" | "anniversary" | "graduation" | "work_milestone" | "remembrance" | "other";

/** The kinds a person can add besides their birthday. */
export type OtherDayKind = Exclude<OccasionKind, "birthday">;

export type TitleChip = { title: string; recurring: boolean };

export type OccasionType = {
  kind: OccasionKind;
  /** "Anniversary", "Work milestone"… (the select and the filters). */
  label: string;
  /** Used after a name when there's no title: "Khalid's anniversary". */
  noun: string;
  emoji: string;
  /** Repeat when no chip was picked. */
  defaultRecurring: boolean;
  titleRequired: boolean;
  placeholder: string;
  chips: TitleChip[];
  /** Gentle: no confetti, "celebrate", excitement or gift actions. */
  gentle: boolean;
  /** Can it count "N years" from a start year (yearly days only)? */
  countsYears: boolean;
};

const yearly = (title: string): TitleChip => ({ title, recurring: true });
const once = (title: string): TitleChip => ({ title, recurring: false });

export const OCCASION_TYPES: Record<OccasionKind, OccasionType> = {
  birthday: {
    kind: "birthday",
    label: "Birthday",
    noun: "birthday",
    emoji: "🎂",
    defaultRecurring: true,
    titleRequired: false,
    placeholder: "",
    chips: [],
    gentle: false,
    countsYears: false,
  },
  anniversary: {
    kind: "anniversary",
    label: "Anniversary",
    noun: "anniversary",
    emoji: "💍",
    defaultRecurring: true,
    titleRequired: false,
    placeholder: "e.g. Wedding",
    chips: [yearly("Wedding"), yearly("The day we met"), yearly("Friendship anniversary")],
    gentle: false,
    countsYears: true,
  },
  graduation: {
    kind: "graduation",
    label: "Graduation",
    noun: "graduation",
    emoji: "🎓",
    defaultRecurring: false,
    titleRequired: false,
    placeholder: "e.g. Bachelor's",
    chips: [once("Bachelor's"), once("Master's"), once("Finished a course")],
    gentle: false,
    countsYears: false,
  },
  work_milestone: {
    kind: "work_milestone",
    label: "Work milestone",
    noun: "work milestone",
    emoji: "💼",
    defaultRecurring: true,
    titleRequired: false,
    placeholder: "e.g. New job",
    chips: [
      once("New job"),
      once("Promotion"),
      yearly("Work anniversary"),
      yearly("Opened a business"),
    ],
    gentle: false,
    countsYears: true,
  },
  remembrance: {
    kind: "remembrance",
    label: "Remembrance",
    noun: "day of remembrance",
    emoji: "🕊️",
    defaultRecurring: true,
    titleRequired: false,
    placeholder: "In memory of…",
    chips: [],
    gentle: true,
    countsYears: false,
  },
  other: {
    kind: "other",
    label: "Something else",
    noun: "special day",
    emoji: "✨",
    defaultRecurring: false,
    titleRequired: true,
    placeholder: "e.g. First marathon",
    chips: [once("First marathon"), once("Moved to a new city"), once("Got their licence")],
    gentle: false,
    countsYears: false,
  },
};

/** The order in the "Kind of day" select. */
export const OTHER_DAY_KINDS: OtherDayKind[] = [
  "anniversary",
  "graduation",
  "work_milestone",
  "remembrance",
  "other",
];

export const occasionType = (kind: string): OccasionType =>
  OCCASION_TYPES[kind as OccasionKind] ?? OCCASION_TYPES.other;

/**
 * The type as shown for a person: someone "In memory" (people.in_memory) has
 * every day in the gentle Remembrance style: 🕊️, no "turns N", no
 * celebrating, no gift actions. Their birthday stays "birthday" by name.
 */
export const typeFor = (kind: string, inMemory?: boolean | null): OccasionType => {
  const type = occasionType(kind);
  return inMemory ? { ...type, emoji: "🕊️", gentle: true, countsYears: false } : type;
};

/**
 * What a day is called: "Khalid's anniversary" without a title,
 * "Khalid · New job" with one.
 */
export function occasionTitle(name: string, kind: string, title: string | null | undefined) {
  const t = title?.trim();
  if (t) return `${name} · ${t}`;
  return `${name}'s ${occasionType(kind).noun}`;
}
