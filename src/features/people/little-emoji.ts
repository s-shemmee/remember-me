/**
 * The emoji of a little thing (Notion-style; what people write is theirs, so
 * emoji are welcome here). Pure: the picker, the schema and Vitest use it.
 *
 * - DEFAULT_EMOJI when none is chosen.
 * - EMOJI_GRID: ~48 common ones for the picker, with names for screen readers.
 * - suggestEmoji(): a small local keyword map while typing (no AI call).
 * - isSingleEmoji(): exactly one emoji grapheme, at most 16 bytes (the
 *   database checks the bytes too; Postgres can't count graphemes).
 */
export const DEFAULT_EMOJI = "❤️";

export const EMOJI_GRID: readonly { emoji: string; name: string }[] = [
  // Food and drinks
  { emoji: "☕", name: "coffee" },
  { emoji: "🍵", name: "tea" },
  { emoji: "🧋", name: "bubble tea" },
  { emoji: "🍫", name: "chocolate" },
  { emoji: "🍰", name: "cake" },
  { emoji: "🍕", name: "pizza" },
  { emoji: "🍣", name: "sushi" },
  { emoji: "🍜", name: "noodles" },
  { emoji: "🥐", name: "croissant" },
  { emoji: "🍓", name: "strawberry" },
  { emoji: "🌮", name: "taco" },
  { emoji: "🍷", name: "wine glass" },
  // Sports and hobbies
  { emoji: "⚽", name: "football" },
  { emoji: "🏀", name: "basketball" },
  { emoji: "🎾", name: "tennis" },
  { emoji: "🏃", name: "running" },
  { emoji: "🧘", name: "yoga" },
  { emoji: "🧗", name: "climbing" },
  { emoji: "🚴", name: "cycling" },
  { emoji: "🏊", name: "swimming" },
  { emoji: "🎮", name: "video games" },
  { emoji: "🧩", name: "puzzle" },
  { emoji: "🎨", name: "painting" },
  { emoji: "📷", name: "camera" },
  // Books and music
  { emoji: "📚", name: "books" },
  { emoji: "🚀", name: "rocket" },
  { emoji: "✍️", name: "writing" },
  { emoji: "🎶", name: "music" },
  { emoji: "🎸", name: "guitar" },
  { emoji: "🎧", name: "headphones" },
  { emoji: "🎬", name: "film" },
  { emoji: "🎤", name: "singing" },
  // Nature and animals
  { emoji: "🌻", name: "sunflower" },
  { emoji: "🌸", name: "blossom" },
  { emoji: "🪴", name: "potted plant" },
  { emoji: "🌊", name: "sea" },
  { emoji: "⛰️", name: "mountain" },
  { emoji: "🐱", name: "cat" },
  { emoji: "🐶", name: "dog" },
  { emoji: "🐴", name: "horse" },
  // Travel and home
  { emoji: "✈️", name: "travel" },
  { emoji: "🏖️", name: "beach" },
  { emoji: "🏕️", name: "camping" },
  { emoji: "🕯️", name: "candle" },
  { emoji: "🛋️", name: "home" },
  { emoji: "🧶", name: "knitting" },
  { emoji: "💄", name: "make-up" },
  { emoji: "❤️", name: "red heart" },
];

/** Keyword stems → emoji. The first match in the text wins. */
const KEYWORDS: [RegExp, string][] = [
  [/\bcoffee|espresso|latte|cappuccino/i, "☕"],
  [/\bmatcha|\btea\b|mint tea|chai/i, "🍵"],
  [/bubble tea|boba/i, "🧋"],
  [/chocolate|cocoa/i, "🍫"],
  [/\bcakes?\b|pastr|baking|bake/i, "🍰"],
  [/pizza/i, "🍕"],
  [/sushi/i, "🍣"],
  [/ramen|noodle/i, "🍜"],
  [/croissant|bread/i, "🥐"],
  [/football|soccer/i, "⚽"],
  [/basketball/i, "🏀"],
  [/tennis|padel/i, "🎾"],
  [/\brun(s|ning)?\b|marathon|jogging/i, "🏃"],
  [/yoga|meditat/i, "🧘"],
  [/climb|boulder/i, "🧗"],
  [/cycl|bike|biking/i, "🚴"],
  [/swim/i, "🏊"],
  [/gaming|video ?games?|playstation|xbox|nintendo/i, "🎮"],
  [/puzzle|board games?|chess/i, "🧩"],
  [/paint|drawing|watercolou?r|\bart\b/i, "🎨"],
  [/photo|camera/i, "📷"],
  [/sci-?fi|space|astronom|stars\b/i, "🚀"],
  [/\bbooks?\b|reading|novels?|poetry/i, "📚"],
  [/writing|journal/i, "✍️"],
  [/guitar/i, "🎸"],
  [/music|songs?\b|vinyl|records?\b|jazz|concert/i, "🎶"],
  [/podcast|headphones/i, "🎧"],
  [/films?\b|movies?|cinema/i, "🎬"],
  [/sing|karaoke/i, "🎤"],
  [/sunflower|flowers?|roses?\b|tulips?|jasmine|bouquet/i, "🌻"],
  [/plants?\b|garden/i, "🪴"],
  [/\bsea\b|ocean|surf/i, "🌊"],
  [/hiking|mountain/i, "⛰️"],
  [/\bcats?\b|kitten/i, "🐱"],
  [/\bdogs?\b|puppy|puppies/i, "🐶"],
  [/horse|riding/i, "🐴"],
  [/travel|trips?\b|flights?|abroad/i, "✈️"],
  [/beach/i, "🏖️"],
  [/camping|tent/i, "🏕️"],
  [/candles?/i, "🕯️"],
  [/knit|crochet/i, "🧶"],
  [/make-?up|lipstick/i, "💄"],
  [/wine/i, "🍷"],
];

/** An emoji for what's being typed ("black coffee" → ☕), or null. */
export function suggestEmoji(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  return KEYWORDS.find(([re]) => re.test(t))?.[1] ?? null;
}

const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** Exactly one emoji grapheme: "⚽", "👩🏽‍💻", "🇲🇦"; never "a", "⚽⚽" or " ⚽". */
export function isSingleEmoji(value: string): boolean {
  if (!value || value !== value.trim() || /[!-~]/.test(value)) return false;
  if (new TextEncoder().encode(value).length > 16) return false;
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)];
  return graphemes.length === 1 && PICTOGRAPHIC.test(value);
}

export type LittleThing = { emoji: string; text: string };

/** From the two database arrays (emoji may be missing for old rows: a heart). */
export function littleThingsOf(
  texts: string[],
  emojis: string[] | null | undefined,
): LittleThing[] {
  return texts.map((text, i) => ({ text, emoji: emojis?.[i] || DEFAULT_EMOJI }));
}
