# Design system

Source of truth: the design canvas, "Final · Playful" page (landing sections 1–3, sign up, log in, onboarding, and the 7 app screens). Tagline for the style: **playful to act, iOS-calm to show.**

## Brand
- **Logo:** a plain white heart in a rounded square (`--accent`, 32px, radius 10) + "Remember" (Plus Jakarta Sans 800) + "*me*" (Instrument Serif italic, `--accentText`). No candle in the logo.
- **Noor:** a pink birthday candle with a flickering flame, dot eyes, blush. She is the assistant, not the logo. Sizes: 40–58px in UI, 86–120px in hero moments. Gentle bob animation (off under reduced motion).

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

## Type
- **UI:** Plus Jakarta Sans (400–800). Headings 800, tight tracking (-0.03em).
- **Elegant accent:** Instrument Serif italic, for one or two words in a heading ("one gentle *place*", "Welcome *back*").
- **Handwritten:** Kalam, for small notes, eyebrows ("what's inside"), sticky notes. Scale it to ~0.8 of the size you'd use for Caveat.
- iMessage-style bubbles and iOS notification mock-ups use the system font (`-apple-system`).
- Scale: 64 / 48 / 44 / 34 / 24 / 22 / 19 / 17 / 15 / 13 / 12 px.

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
- **Switch:** `role="switch"`, 48×28, 22px knob, accent when on. Off: `line` track with a 1.5px `sub` outline so it meets 3:1. Touch area 44px tall.
- **Card:** card bg, radius 24, shadow; hoverable cards lift 2px.
- **Person avatar:** circle in the person's pastel, initials in its ink, 800 weight.
- **Countdown pill:** person's pastel fill + ink text ("in 2 days").
- **Plan steps:** 4 round buttons (🎁 Pick gift, 🤫 Reserve, 💌 Write wish, 🎉 Celebrate), filled when done.
- **Noor bubble:** card bg, radius `22 22 22 6`, sits next to Noor, `aria-live="polite"` when it changes.
- **iOS notification card:** glass bg, app icon tile, "REMEMBER ME · now", title + one line.
- **Sidebar (desktop app):** 248px, logo, 5 nav items, "Your day" lilac card, Settings, account chip that opens the account menu (profile, settings, help, log out).

## Motion
- Durations 200–600ms, ease `cubic-bezier(.2,.8,.2,1)`; springy pop `cubic-bezier(.2,.9,.3,1.3)`.
- Allowed: rotating hero words, pen-draw underline, cards fading in once, the reminders card shuffle, wishlist cards tilting on hover, Noor's bob, numbers rolling up once.
- One moving thing per section. Everything off under `prefers-reduced-motion` (and the in-app "Reduce motion" switch).

## Voice
- Warm, short, plain. Talk like a thoughtful friend.
- Noor: first person, kind, encouraging, one emoji max per message. Examples: "Khalid turns 30 in 2 days 🎂 The football on his wishlist is still free. Want me to reserve it for you?" / "Reserved! Only you know 🤫".
- No em dashes in UI copy. No guilt ("You forgot!"). No exclamation spam.
