import { type Pastel, pastels } from "@/styles/tokens";

export { MONTHS } from "@/lib/dates";
export {
  DESCRIPTION_MAX,
  NAME_MAX,
  type Relation,
  RELATION_COLORS,
  RELATIONS,
} from "@/features/people/constants";

/** The 8 characters from the approved screen (AppOnboard), stored by key. */
export const CHARACTERS = [
  { key: "fox", emoji: "🦊", label: "Fox" },
  { key: "cat", emoji: "🐱", label: "Cat" },
  { key: "panda", emoji: "🐼", label: "Panda" },
  { key: "frog", emoji: "🐸", label: "Frog" },
  { key: "unicorn", emoji: "🦄", label: "Unicorn" },
  { key: "sunflower", emoji: "🌻", label: "Sunflower" },
  { key: "bee", emoji: "🐝", label: "Bee" },
  { key: "moon", emoji: "🌙", label: "Moon" },
] as const;
export type CharacterKey = (typeof CHARACTERS)[number]["key"];
export const CHARACTER_KEYS = CHARACTERS.map((c) => c.key) as [CharacterKey, ...CharacterKey[]];
export const characterEmoji = (key: string | null | undefined) =>
  CHARACTERS.find((c) => c.key === key)?.emoji;

/** Reminder chips: days before the day. 7, 1 and 0 are pre-picked. */
export const REMINDER_OPTIONS = [
  { days: 14, label: "2 weeks before" },
  { days: 7, label: "7 days before" },
  { days: 3, label: "3 days before" },
  { days: 1, label: "The day before" },
  { days: 0, label: "The morning of" },
] as const;
export const REMINDER_DAYS = REMINDER_OPTIONS.map((o) => o.days);
export const DEFAULT_REMINDER_OFFSETS = [7, 1, 0];

export const PASTELS = pastels;
export const DEFAULT_AVATAR_COLOR: Pastel = "lilac";

/** Steps 0–3 are the questions; 4 is "You're all set". */
export const STEP_COUNT = 4;
