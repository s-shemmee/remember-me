# Design system

Source of truth: the design canvas, "Final · Playful" page (landing sections 1–3, sign up, log in, onboarding, and the 7 app screens). Tagline for the style: **playful to act, iOS-calm to show.**

## Brand
- **Logo:** a plain white heart in a rounded square (`--accent`, 32px, radius 10) + "Remember" (Plus Jakarta Sans 800) + "*me*" (Instrument Serif italic, `--accentText`). No candle in the logo.
- **Noor:** a pink birthday candle with a flickering flame, dot eyes, blush. Two moods on the `Noor` component: `calm` (dot eyes, small smile; everyday UI) and `smiling` (arched happy eyes, open smile, a glowing inner flame; welcoming moments such as the auth panels, onboarding and celebrations). She is the assistant, not the logo. Sizes: 40–58px in UI, 86–120px in hero moments. Gentle bob animation (off under reduced motion).

## Colour tokens
Define as CSS variables on `:root` (light) and `.dark` (dark). Tailwind reads them.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F4F5F9` | `#0E0E10` | page background (cool, so Noor's pink stands out) |
| `--card` | `#FFFFFF` | `#1A1A1D` | cards, inputs |
| `--card2` | `#E9EBF1` | `#232327` | secondary pills, chips, wells |
| `--text` | `#1C1B1F` | `#F5F4F2` | body text |
| `--sub` | `#5F5C66` | `#A9A6AE` | secondary text |
| `--line` | `#E2E4EB` | `#2C2C31` | borders, dividers |
| `--accent` | `#D63B48` | `#FF8A8E` | primary buttons, focus ring, today |
| `--accentText` | `#C2333F` | `#FF9EA1` | accent text on light surfaces (4.5:1) |
| `--onAccent` | `#FFFFFF` | `#1A0B0C` | text on accent |
| `--glass` | `rgba(255,255,255,.8)` | `rgba(26,26,29,.8)` | frosted header, iOS-style cards |
| `--bubble` | `#E9E9EB` | `#2C2C2E` | incoming chat bubbles |
| `--select` | `#3D6BE0` | `#8AA8FF` | "selected" outlines on illustrations |

**Person pastels** (each person gets one; each has a fill and an ink that passes 4.5:1 on its fill):

| Name | Fill (light / dark) | Ink (light / dark) |
|---|---|---|
| peach | `#FFE5D6` / `#3A2418` | `#8A3B12` / `#FFC6A8` |
| lilac | `#EAE3FF` / `#2A2140` | `#5B3FB5` / `#CDBDFF` |
| mint | `#D7F5E6` / `#12302A` | `#1E6B49` / `#9FE5C4` |
| sky | `#DCEBFF` / `#142640` | `#1F4F8F` / `#A9CBFF` |
| rose | `#FFE0EA` / `#3A1C28` | `#9A2E55` / `#FFB3CB` |
| butter | `#FFF1C2` / `#352C10` | `#5E4500` / `#FFE08A` |

Second tones for gradients: `peach2 #FFCDB8`, `lilac2 #D6CAFF`, `mint2 #BDEDD5`, `rose2 #FFC7D8`.

**Relation colours** (decided Nov 2026): a new person gets their relation's pastel, saved on `people.color` and changeable later in their profile. Anything else (or no relation) is lilac.

| Relation | Pastel |
|---|---|
| Best friend | rose |
| Family | sky |
| Partner | peach |
| Friend | lilac |
| Colleague | mint |

In code: `RELATION_COLORS` in `src/features/onboarding/constants.ts`; the database applies the same default in `complete_onboarding()`.

## Type
- **UI:** Plus Jakarta Sans (400–800). Headings 800, tight tracking (-0.03em).
- **Elegant accent:** Instrument Serif italic, for one or two words in a heading ("one gentle *place*", "Welcome *back*").
- **Handwritten:** Kalam, for small notes, eyebrows ("what's inside"), sticky notes. Scale it to ~0.8 of the size you'd use for Caveat.
- iMessage-style bubbles and iOS notification mock-ups use the system font (`-apple-system`).
- Scale: 64 / 48 / 44 / 34 / 24 / 22 / 19 / 17 / 16 / 15 / 14 / 13 / 12 px (`text-16`, `text-14`, …). 16 is for input text, social buttons and main CTAs; 14 for field labels, the "or with email" divider and small links (as in the approved SignUp / LogIn screens).

## Shape, depth, spacing
- Radius: pills `999px`; cards 24–28px; hero panels 32–36px; inputs 16px; small chips 8–12px.
- Shadow: `0 1px 2px rgba(28,27,31,.04), 0 10px 28px rgba(28,27,31,.07)`; dark mode uses a 1px ring `#26262B` instead.
- Spacing on a 4px grid; sections 72px vertical on landing, 24–28px gaps in the app.
- Feature visuals on the landing page are all the same size (300px tall) so the zigzag has rhythm.

## Components
All live in `src/components/ui/`. Button, Switch, Dialog, Dropdown Menu, Tabs and Sonner are shadcn/ui (Radix) restyled to these tokens; Card, Chip, Avatar, Field, Noor and NoorBubble are our own.

- **Button (pill):** pill-shaped by design; there is no separate Pill component. Min-height 44px (54px for main CTAs, `size="lg"`), radius 999, weight 600. Variants: accent, card2, transparent. Hover lifts 1px; active scales .97.
- **Social button:** full width, card background, 1.5px line border, Google/Apple mark + "Continue with…".
- **Field:** visible label above, 52px input, 1.5px line border, focus = accent border + 4px soft ring. Helper text under in `--sub`.
- **Chip / filter:** 36–44px, selected = `--text` fill with `--bg` text.
- **Relation chip:** 44px pill on `card2` with a 10px dot in the relation's ink; selected fills with the relation's pastel, ink text and a 2px ink ring (a radio group: arrows move and select).
- **Switch:** `role="switch"`, 48×28, 22px knob, accent when on. Off: `line` track with a 1.5px `sub` outline so it meets 3:1. Touch area 44px tall.
- **Card:** card bg, radius 24, shadow; hoverable cards lift 2px.
- **Person avatar:** circle in the person's pastel, initials in its ink, 800 weight.
- **Names:** at most 40 characters. A name on its own line gets `truncate`; a name inside a heading uses `TruncatedName` (one line, ellipsis); a name inside a sentence (Noor, body copy) wraps with `overflow-wrap: anywhere`. A name never makes the page scroll sideways.
- **Countdown pill:** person's pastel fill + ink text ("in 2 days").
- **Plan steps:** round buttons with a Lucide icon per step (gift, mail, phone, cake…; `src/features/plans/step-icon.tsx`), filled when done.
- **Noor bubble:** card bg, radius `22 22 22 6`, sits next to Noor, `aria-live="polite"` when it changes.
- **iOS notification card:** glass bg, app icon tile, "REMEMBER ME · now", title + one line.
- **Page header (every signed-in page, `PageHeader`):** the title (and a line under it) on the left; on the right, always in this order and skipping what a page doesn't have: search → primary button → theme toggle → notification bell (always last). Home: search, Add someone, bell (no theme toggle). People: search, Add someone, theme, bell. Calendar: Add someone, theme, bell. Wishlists: Add a wish, theme, bell. Celebrate Me: My wishlist, theme, bell. My profile, Settings, Help & feedback: bell only. The theme toggle is a 44px round icon button (moon in light, sun in dark; "Switch to dark mode" / "Switch to light mode"), the same saved choice as Settings → Appearance. The bell is behind `NOTIFICATIONS_INBOX_ENABLED` (off: nothing, no gap). Below 1024px the actions are 44px icon buttons in the same order; the search button opens the field on its own line.
- **Sidebar (desktop app):** 248px, logo, 5 nav items, "Your day" lilac card, and the account chip that opens the account menu: My profile, Settings, Help & feedback (Lucide icons), a divider, then "Log out" as plain text. That menu is the only way to Settings; no theme control in it.
- **Settings:** a page per section (/settings/reminders, notifications, privacy, appearance, account). Desktop: title, "Saved automatically as you go", a pill tab bar of links (`aria-current="page"`, Lucide icons in accent). Phones: /settings is a grouped list (icon, title, subtitle, chevron), each section has a back button. Account ends with the delete-account danger card, then an outlined "Log out".
- **Mobile app shell (below 1024px):** a top bar with the logo and your avatar (opens the same account menu, where Settings lives; My profile also ends with Settings and Help & feedback rows), and a bottom tab bar with the five sections: glass background, 24px icon over a 12px label, at least 60px tall, the current one in `accentText`, room for the home indicator (`safe-area-inset-bottom`).
- **Person card (People grid):** card with the avatar in their pastel, name, relation (their description when set, else the chip) and a countdown pill for their next day ("Birthday · in 2 days"). Three columns when there's room; in a narrow list (phones) it becomes a compact row with the avatar on the left. The open person gets a 2.5px accent ring.
- **Stat card (Home):** person-pastel fill with its ink, radius 24, at least 128px tall: a small caps label with a Lucide icon, a 30px value, one line under it. 2 columns on phones, 4 from 1280px.
- **Mini month (Home):** a table, Monday first, 34px day circles; days with something get bold text and up to three 5px dots in each person's ink; today is filled accent. Legend: ● today, ● your day.
- **Calendar grid:** 92px cells (56px on phones), radius 16, name tags (a Lucide occasion icon + `Khalid`, person pastel, radius 8, 12px) on wider screens and dots on phones; days with something get `card2`; today's number is filled accent; the selected day has a 2px accent ring; past days have a `sub` number and no background (no opacity: it would break contrast).
- **Occasion types:** Birthday, Anniversary, Graduation, Work milestone, Remembrance, Something else (table in `src/features/occasions/types.ts`). Each has one emoji in the table (🎂 💍 🎓 💼 🕊️ ✨), used in the app (`<OccasionEmoji>`, decorative), Noor's messages, emails and push. 🕯️ is Noor's. In the person dialog each other day has: Kind of day (select), Title (optional, "What's the day called?" for Something else) with suggestion chips under it (44px pills on `card`, pressed = `text` fill), and "Repeats: Once · Every year" (a radio group). Remembrance is gentle: the dove, quiet `card2` countdown pills, no celebration words.
- **Wish card:** card with a 4:3 photo (or a gift-icon tile in a pastel), title, "price · shop" (the link's domain), the note, a priority pill (Love it, Like it, Nice to have, each with a Lucide icon) and "Open link"; a ⋯ menu (Edit, Move earlier, Move later, Remove) sits on the photo. The last tile is a dashed "Add a wish" card.
- **Invite link dialog:** the link in a read-only field with Copy, "It works once, for 7 days", and a note that it's only shown once.
- **Profile panel (People):** next to the grid from 1280px; below that it replaces the grid with "← All people". Top to bottom: avatar, name, "relation · Connected/Not connected"; Days to remember (occasion icon, title, full date, an "in N days" pill in their pastel); Little things (pills: emoji + text, in their pastel); Their wishlist (the first three: thumbnail, title, price and a status pill, Reserved by you / Free / Taken, then "See all"; not connected: "Not connected yet, so no shared wishlist." + "Invite them"); then "Plan their day" (accent) and Edit. Person cards carry a small accent link badge on the avatar when connected.
- **Emoji picker (little things):** a 44px button showing the emoji ("Choose an emoji for …"), opening a popover: 48 common emoji in an 8-column grid (arrow keys move, Enter picks, the current one pressed), "Or type any emoji" (exactly one), and "Reset to heart". Escape closes it and focus returns to the button. While typing, a local keyword map suggests one (coffee → ☕); a hand-picked emoji is never replaced. ❤️ is the default.

## Motion
- Durations 200–600ms, ease `cubic-bezier(.2,.8,.2,1)`; springy pop `cubic-bezier(.2,.9,.3,1.3)`.
- Allowed: rotating hero words, pen-draw underline, cards fading in once, the reminders card shuffle, wishlist cards tilting on hover, Noor's bob, numbers rolling up once.
- Exception, auth panels only (sign-up, log-in and their sibling pages): items fade up once with a stagger (0.2s / 0.7s / 1.2s / 1.7s, 0.6s each), one card per panel floats 8px three times (about 15s) and rests, and Noor bobs. See docs/decisions.md.
- One moving thing per section. Everything off under `prefers-reduced-motion` (and the in-app "Reduce motion" switch).

## Voice
- Warm, short, plain. Talk like a thoughtful friend.
- **Icons for controls, emoji for content:** Lucide icons on nav, header buttons, menus, all of Settings, Help topics, buttons, form controls and toasts. Emoji for content and feeling: Home's stat tiles and plan steps, occasion types wherever a day is shown, My profile's birthday pill and Who can see what tiles, Noor, and what people write themselves. Never in page titles or the Home greeting. Next to text, an emoji is `aria-hidden`. Full rule: docs/design/DESIGN.md "Icons and emoji".
- Noor: first person, kind, encouraging, one emoji max per message. Examples: "Khalid turns 30 in 2 days 🎂 The match ball (350 MAD) on Khalid's wishlist is still free. Want me to reserve it for you?" (names, never pronouns) / "Reserved! Only you know 🤫".
- No em dashes in UI copy. No guilt ("You forgot!"). No exclamation spam.
