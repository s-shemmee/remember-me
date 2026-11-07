import { createCn } from "cn/config";

/**
 * Class merger that knows our Tailwind theme (src/app/globals.css).
 * Without this, `cn("text-15", "text-sub")` drops the font size (it reads
 * `text-15` as a colour) and `rounded-pill` doesn't override `rounded-card`.
 *
 * Always import `cn` from here, never from the "cn" package directly
 * (ESLint enforces this). Keep these lists in sync with the @theme block.
 */
export const cn = createCn({
  extend: {
    theme: {
      text: ["64", "48", "44", "34", "24", "22", "19", "17", "16", "15", "14", "13", "12"],
      radius: [
        "pill",
        "card",
        "card-lg",
        "panel",
        "panel-lg",
        "input",
        "chip",
        "item",
        "popover",
        "bubble",
      ],
      shadow: ["card", "popover"],
      font: ["hand", "system"],
      tracking: ["heading"],
      ease: ["soft", "pop"],
    },
  },
});
