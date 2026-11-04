/**
 * Token metadata for docs, the token check page and tests.
 * Values live in src/app/globals.css; components should use Tailwind
 * utilities (bg-card, text-sub…), never these hex strings.
 */

export const coreTokens = [
  { name: "bg", use: "Page background" },
  { name: "card", use: "Cards, inputs" },
  { name: "card2", use: "Secondary pills, chips" },
  { name: "text", use: "Body text" },
  { name: "sub", use: "Secondary text" },
  { name: "line", use: "Borders, dividers" },
  { name: "accent", use: "Primary buttons, focus" },
  { name: "accentText", use: "Accent text" },
  { name: "onAccent", use: "Text on accent" },
  { name: "glass", use: "Frosted surfaces" },
  { name: "bubble", use: "Incoming chat bubbles" },
  { name: "select", use: "Selected outlines" },
] as const;

export const pastels = ["peach", "lilac", "mint", "sky", "rose", "butter"] as const;
export type Pastel = (typeof pastels)[number];

export const typeScale = [64, 48, 44, 34, 24, 22, 19, 17, 15, 13, 12] as const;
