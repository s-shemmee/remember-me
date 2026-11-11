import type { Pastel } from "@/styles/tokens";

/** Names (yours and your people's) are at most 40 characters everywhere. */
export const NAME_MAX = 40;

/** "How you'd describe them" (people.relation), e.g. "Little sister". */
export const DESCRIPTION_MAX = 30;

/** Each little thing they love, and how many a person can have. */
export const LITTLE_THING_MAX = 60;
export const LITTLE_THINGS_LIMIT = 20;

/** Other days per person (besides the birthday). */
export const OTHER_DAYS_LIMIT = 10;
export const DAY_TITLE_MAX = 40;

/** Relation chips, saved as people.relation_kind. */
export const RELATIONS = ["Best friend", "Family", "Partner", "Friend", "Colleague"] as const;
export type Relation = (typeof RELATIONS)[number];

/**
 * Each relation's colour (docs/design-system.md). A person gets their
 * relation's colour unless one is picked; saved on people.color.
 * save_person() and complete_onboarding() apply the same default.
 */
export const RELATION_COLORS: Record<Relation, Pastel> = {
  "Best friend": "rose",
  Family: "sky",
  Partner: "peach",
  Friend: "lilac",
  Colleague: "mint",
};

/** People filters on /people, by people.group. */
export const FILTERS = [
  { key: "all", label: "All" },
  { key: "family", label: "Family" },
  { key: "friends", label: "Friends" },
  { key: "work", label: "Work" },
  { key: "connected", label: "Connected" },
] as const;
export type FilterKey = (typeof FILTERS)[number]["key"];

export const isRelation = (value: string | null | undefined): value is Relation =>
  RELATIONS.includes(value as Relation);
