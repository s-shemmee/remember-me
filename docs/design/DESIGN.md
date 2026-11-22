# Remember Me — Design system and UI rules

Read this before changing any UI. The code (Tailwind theme, `globals.css`, shadcn components) is the source of truth for exact values; this file explains the intent and the rules. If they disagree, follow the code and fix this file in the same PR.

## Personality

Playful, bright, never overwhelming. iOS-clean surfaces, soft pastels (one per person), rounded everything, gentle motion. Warm, short, human copy. Noor, a small pink birthday candle, is the mascot and the only "voice" allowed to be cute.

## Colour tokens

Light (default) / Dark:

| Token | Light | Dark | Use |
|---|---|---|---|
| bg | #F4F5F9 | #0E0E10 | page background |
| card | #FFFFFF | #1A1A1D | cards, header buttons, menus |
| card2 | #E9EBF1 | #232327 | secondary buttons, segmented tracks, chips off |
| text | #1C1B1F | #F5F4F2 | body text |
| sub | #5F5C66 | #A9A6AE | helper text, timestamps |
| line | #E2E4EB | #2C2C31 | borders, dividers |
| accent | #D63B48 | #FF8A8E | primary buttons, switches on, badges, focus ring |
| accentText | #C2333F | #FF9EA1 | accent-coloured text and icons (passes 4.5:1) |
| onAccent | #FFFFFF | #1A0B0C | text on accent |
| bubble | #E9E9EB | #2C2C2E | Noor chat bubbles |
| glass | rgba(255,255,255,.8) | rgba(26,26,29,.8) | phone tab bar (blurred) |

Person pastels (background / ink): peach #FFE5D6 / #8A3B12, lilac #EAE3FF / #5B3FB5, mint #D7F5E6 / #1E6B49, sky #DCEBFF / #1F4F8F, rose #FFE0EA / #9A2E55, butter #FFF1C2 / #5E4500. Each person gets one pastel for avatar, pills and highlights. Dark versions: peach #3A2418/#FFC6A8, lilac #2A2140/#CDBDFF, mint #12302A/#9FE5C4, sky #142640/#A9CBFF, rose #3A1C28/#FFB3CB, butter #352C10/#FFE08A.

Shadow (light): `0 1px 2px rgba(28,27,31,.04), 0 10px 28px rgba(28,27,31,.07)`. Dark mode uses a 1px ring (`0 0 0 1px #26262B`) instead of shadows.

## Type

- UI: Plus Jakarta Sans (`font-sans`, loaded in `src/app/layout.tsx`).
- Instrument Serif italic in the accent colour (`font-serif`) for one or two words in key headings: the Home greeting name ("Good afternoon, *Maya*"), Celebrate *Me*, Birthday *memories*, the help center and auth headings.
- Kalam (`font-hand`) only for small handwritten touches (the little line on My profile, the Celebrate Me countdown line).
- Page title 28px on phones, 34px from 640px (`PageHeader`) / 800 / -0.03em. Section title 18–22px / 800. Body 15px. Helper 13px. Labels on tiles 12px / 700 / uppercase / +0.05em.

## Shape and spacing

- Radius (Tailwind theme in `globals.css`): page cards 28px (`rounded-card-lg`), tiles 24px (`rounded-card`), list rows 16–20px, text inputs 16px (`rounded-input`), buttons, chips and search fields full pill (999px), menus 20px, icon squares 12px.
- Touch targets ≥ 44px. Header icon buttons (search on phones, theme, bell) are 44px circles on `card2`, no shadow.
- Gaps: 24–28px between page sections, 12–16px inside cards.

## Icons and emoji

- **Icons (Lucide) for app controls**: sidebar nav, header buttons, account menu, all of Settings (tabs, section headings, rows), Help topic cards, buttons, form controls, toasts. Stroke 2, 18–20px; where one must stand out (Settings, Help topics), tint it with `accentText`, alone or in a 12px-radius `card2`/`card` square.
- **Emoji for content and feeling**:
  - Home: the stat tiles (Next up 🎂, This month 🗓️, Your day 🕯️, Gifts sorted 🎁) and the birthday plan steps (`STEP_EMOJI`: Gift 🎁, Message 💌, Call 📞, Cake 🎂…).
  - Occasion types, wherever a day is shown (People "Days to remember", Calendar, Home "Coming up" and Next up): birthday 🎂, anniversary 💍, graduation 🎓, work milestone 💼, remembrance 🕊️, something else ✨; your own day ✨. One map: `OCCASION_TYPES` in `src/features/occasions/types.ts`, shown with `<OccasionEmoji>`.
  - My profile: the birthday pill (🎂 22 November · in 18 days) and Who can see what (🎂 Your birthday, 🎁 Birthday wishlist, 🔒 Treat yourself).
  - Noor's messages and nudges; user content (wish titles, little things with their emoji, default ❤️; notes); the character avatars people pick.
- No emoji in page titles or the Home greeting, or in the controls listed above (the "Kind of day" select stays text; "Add Gift" style buttons keep their Lucide step icons).
- An emoji next to text is decorative: `<span aria-hidden="true">`, so screen readers read only the label.

## App shell

- Desktop (from 1024px): left sidebar (248px) + main. Sidebar = logo, Home, People, Calendar, Wishlists, Celebrate Me, the "Your day" countdown card, and the account button (avatar, first name, "7 people", ⋯) at the bottom.
- Settings is NOT in the sidebar.
- Account menu (opens upward from the account button): My profile · Settings · Help & feedback (Lucide icons) · divider · "Log out" as plain text, no icon. No theme control here.
- Phone: a top bar (logo, and your avatar opening the same account menu) and a bottom tab bar Home · People · Calendar · Wishlists · Celebrate. My profile ends with Settings and Help & feedback rows on phones.

## Page header (shared `<PageHeader>`)

Left: title (Home: greeting + date line). Right side always in this order, skipping what a page doesn't have: **search → primary button → theme toggle → bell**. The bell is always the last item.

| Page | Right side |
|---|---|
| Home | search · Add someone · bell (no theme toggle: header is full) |
| People | search · Add someone · theme · bell |
| Calendar | Add someone · theme · bell |
| Wishlists | Add a wish · theme · bell |
| Celebrate Me | My wishlist · theme · bell |
| My profile, Settings, Help & feedback | bell |

Theme toggle: moon in light, sun in dark ("Switch to dark mode" / "Switch to light mode"); same stored preference as Settings → Appearance. Bell is behind `NOTIFICATIONS_INBOX_ENABLED` (off: not rendered); until the inbox exists it links to Settings → Notifications. Phones: the actions become 44px icon buttons in the same order, and search opens its field on its own line.

## Page layouts

- **Home**: header → Noor nudge card (candle + iMessage-style bubble + actions) → 4 pastel stat tiles (Next up, This month, Your day, Gifts sorted) → "Coming up" list with filter chips and plan dots, beside the next person's birthday plan (4 steps) and a mini month calendar.
- **People**: filter chips → desktop (from 1280px) two columns: people cards (left) and the selected person's panel (right: Days to remember with countdown pills, Little things chips with emoji, Their wishlist with thumbnails and status, or "Not connected yet" + Invite them; actions Plan their day / Edit). Cards: 52px avatar with a "Connected" card2 badge on the right, next-day pill with its occasion emoji, selected = 2px accent ring. Panel: one card; days as card2 rows with the countdown in the person's ink; little things in one wrapping row; wishlist rows outlined (1.5px line, no fill) with "See all" beside the label; "Invite them" as an accent link. Below 1280px: list → person page ("All people" goes back). No pending-request banner: connections are made only by accepting an invite link.
- **Wishlists**: tabs My wishlists / Friends' wishlists → list chips → item cards (image, title, price · shop; on friends' lists a status: Reserved by you / Already taken / Reserve it). The owner never sees anything about reservations on their own wishes (not even that one exists), and nobody sees who reserved.
- **My profile**: from 1024px two columns (1/3 and 2/3, both aligned to the top, 24px gap); narrower, one column in the same order.
  - Left: **Your card** (rose gradient, centered: 112px avatar with an accent edit button bottom right, full name, "@handle · City", birthday pill "🎂 22 November · in 18 days", the little line in quotes in Kalam, then 3 number tiles inside the card: people, wishlists, days remembered) → **Invite your people** (one line, the link in a read-only field, Copy).
  - Right: **About you** (First name | Last name, Birthday | City, then "A little line about you" and Time zone full width; Save changes → Saved) → **Who can see what** ("Privacy settings" link; 3 pastel tiles in a row: 🎂 Your birthday, 🎁 Birthday wishlist, 🔒 Treat yourself, each with who) → **Connected with you** ("All people" link; avatar + name chips that wrap; an empty state when none).
- **Settings**: /settings/{reminders,notifications,privacy,appearance,account}; /settings opens Reminders on desktop. Desktop: title, "Saved automatically as you go", pill tab bar (links, `aria-current`), one section at a time as cards. Phone: grouped list → drill-in pages with a back button. Account ends with the delete card, then an outlined "Log out".
- **Help & feedback** (/help when signed in; visitors get the public help center there): Ask Noor card (only when `AI_ENABLED`) → Browse help on the page background, not in a card ("Browse help" + "Open help center" → /help?center; 6 topic link cards, 3/2/1 per row: card, shadow, 22px radius, 36px accent-tint icon square) → Send feedback form (type, message, device-info switch; 5 a day) → footer (contact, version, Privacy, Terms).

## Noor

- Look: pink candle body with darker stripes, flickering orange flame, dot eyes, small smile, blush. Gentle bob animation; respect reduced motion.
- Voice: first person, short, warm, one emoji at most per message, never pushy, never guilt. Speaks in iMessage-style bubbles (grey `bubble`, tail bottom-left: radius 22 22 22 6).
- Never reveals who reserved a gift. Only helps with Remember Me.

## Motion and accessibility

- 200–600ms with the soft ease (`ease-soft`); buttons lift 1px on hover and scale to .97 when pressed. At most one moving thing per section; nothing loops forever except Noor's bob. Everything off under `prefers-reduced-motion`.
- Real `<button>`/`<a>`/`<input>`+`<label>`; aria-labels on icon-only buttons (the visible text, if any, starts the name); visible 3px accent focus ring (offset 3px); text contrast ≥ 4.5:1; axe clean in CI.
