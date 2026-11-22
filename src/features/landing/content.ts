/**
 * The landing page's words (docs/design/screens S1Hero, S2Features, S3Rest,
 * with the copy fixes in docs/decisions.md, "Landing page"). Real content
 * only: no reviews, counts or testimonials. Demo people (Sara, Khalid, Omar…)
 * are fictional and every panel that shows them says "Example".
 *
 * The FAQ here feeds both the visible section and the FAQPage JSON-LD, so
 * they can't drift apart.
 */

export const SITE_NAME = "Remember Me";

export const SEO_TITLE = "Remember Me · Never forget the people you love";

export const SEO_DESCRIPTION =
  "A gentle place for the people you love: birthdays and special days, gift wishlists with secret reservations, kind reminders, and your own day too. Free.";

/** The rotating words in the hero: once through, ending on "own". */
export const HERO_WORDS = ["best friend's", "mom & dad's", "little sister's", "own"] as const;

/** What screen readers read as the h1 (the rotation is decorative). */
export const HERO_HEADING =
  "Never forget your best friend's, mom & dad's, little sister's or own special day.";

export const HERO_LEAD =
  "A gentle place for the people you love: their special days, the gifts they're wishing for, and your own day too.";

/** Under the CTAs (Apple sign-in is hidden; Google and email are what we have). */
export const SIGN_UP_NOTE = "Free, with Google or email ✨";

export type Faq = { question: string; answer: string };

export const FAQ: Faq[] = [
  {
    question: "Is Remember Me free?",
    answer: "Yes. People, dates, reminders and wishlists are free.",
  },
  {
    question: "How do I sign up?",
    answer: "With your Google account in one tap, or with your email. No social media needed.",
  },
  {
    question: "Do my friends need an account?",
    answer:
      "No. You can add anyone. If they join, you connect and see each other's shared wishlists.",
  },
  {
    question: "Will my friend know I reserved their gift?",
    answer:
      "Never. Reservations are hidden from the wishlist owner. Other friends only see that it's taken.",
  },
  {
    question: "Does it work on my phone?",
    answer:
      "You can install Remember Me on your phone today from the browser. Native Android and iPhone apps come later.",
  },
];

export { CONTACT_EMAIL } from "@/lib/contact";

/** Example reminders for the card stack (feature 01). */
export const DEMO_REMINDERS = [
  {
    emoji: "🎂",
    when: "now",
    title: "Khalid's birthday is tomorrow",
    line: "Little thing: a new football ⚽",
    pastel: "butter",
  },
  {
    emoji: "💍",
    when: "9:00",
    title: "Mom & Dad's anniversary is in 7 days",
    line: "32 years together",
    pastel: "sky",
  },
  {
    emoji: "🎓",
    when: "yesterday",
    title: "Today: Yasmine's graduation",
    line: "Send her something sweet 💌",
    pastel: "rose",
  },
  {
    emoji: "🎁",
    when: "2h ago",
    title: "Sara's Instax is still free",
    line: "Reserve it before someone else does",
    pastel: "mint",
  },
  {
    emoji: "✨",
    when: "Mon",
    title: "Your day is in 12 days",
    line: "Your plan is 2 of 4 ready",
    pastel: "lilac",
  },
] as const;

/** The plan steps shown in feature 02: the app's real suggestions. */
export const DEMO_PLAN = [
  { emoji: "🎁", label: "Gift" },
  { emoji: "💌", label: "Message" },
  { emoji: "📞", label: "Call" },
  { emoji: "🎂", label: "Cake" },
] as const;

/** What Noor says as the demo plan fills up (by steps done). */
export const DEMO_PLAN_NOOR = [
  "Tap a step to start. A gift idea, maybe? 🎁",
  "Good start! Keep going ✨",
  "Halfway there 🎉",
  "Almost! One more to go 💌",
  "All done. Sara is lucky to have you 🥹",
] as const;
