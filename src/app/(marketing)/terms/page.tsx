/*
 * Terms of use. Plain English, matched to what the app does (fix/launch-prep,
 * Nov 2026). Bump TERMS_UPDATED (src/features/legal/updated.ts) when the text
 * changes.
 *
 * NOTE: this text has not been reviewed by a lawyer. Have a legal
 * professional review it before scaling beyond a small group of users.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { LegalLink, LegalList, LegalPage, type LegalSection } from "@/features/legal/legal-page";
import { TERMS_UPDATED } from "@/features/legal/updated";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Terms · Remember Me",
  description: "The simple rules for using Remember Me: free, for ages 16 and up, kind use only.",
  alternates: { canonical: "/terms" },
};

const sections: LegalSection[] = [
  {
    id: "the-service",
    title: "The service",
    body: (
      <p>
        Remember Me helps you remember the people you love: their days, their wishes, and your own
        day too. It&apos;s free, with no ads. We may add, change or retire features as it grows,
        and we&apos;ll tell you before anything important changes.
      </p>
    ),
  },
  {
    id: "who-can-use-it",
    title: "Who can use it",
    body: (
      <LegalList>
        <li>You must be 16 or older.</li>
        <li>One account per person, with an email address you can reach.</li>
        <li>Keep your password to yourself; you&apos;re responsible for what happens in your account.</li>
      </LegalList>
    ),
  },
  {
    id: "your-content",
    title: "Your content",
    body: (
      <>
        <p>
          What you add (people, days, wishes, photos, plans and notes) stays yours. You let us store
          it and show it to you, and to the connections you choose to share with, only to run
          Remember Me. Nothing else.
        </p>
        <p>
          When you add someone else&apos;s details, add only what they&apos;d be happy for a friend
          to remember, and keep it personal: Remember Me isn&apos;t for business contacts or
          marketing lists. Our{" "}
          <Link href="/privacy" className="font-semibold text-accent-text underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          explains how we look after it.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Be kind",
    body: (
      <>
        <p>Please don&apos;t use Remember Me to:</p>
        <LegalList>
          <li>harass, threaten or embarrass anyone;</li>
          <li>
            send invites to people you don&apos;t know, or in bulk (invites are for people you
            actually know, and you can have up to 20 open at once);
          </li>
          <li>add anything illegal, hateful, or that isn&apos;t yours to share;</li>
          <li>pretend to be someone else;</li>
          <li>
            try to get into other people&apos;s data, break or overload the service, or copy it
            with bots.
          </li>
        </LegalList>
        <p>
          If an account breaks these rules, we may limit or close it. Where we can, we&apos;ll tell
          you why first.
        </p>
      </>
    ),
  },
  {
    id: "connections",
    title: "Connections and reservations",
    body: (
      <p>
        Connecting with a friend shares your first name, look, birthday (if you allow it) and your
        &ldquo;My birthday&rdquo; wishlist with them. Either of you can remove the connection at any
        time. Reserving a friend&apos;s wish is a promise to them, not a purchase: Remember Me
        doesn&apos;t sell anything or handle payments.
      </p>
    ),
  },
  {
    id: "ending",
    title: "Leaving",
    body: (
      <p>
        You can delete your account whenever you like, in Settings, Your data, &ldquo;Delete my
        account&rdquo;. Everything in it is deleted at once. Download your data first if you&apos;d
        like to keep a copy.
      </p>
    ),
  },
  {
    id: "no-warranty",
    title: "No guarantees",
    body: (
      <>
        <p>
          We work hard to make Remember Me reliable, but it&apos;s provided &ldquo;as is&rdquo;,
          without any warranty. Reminders can be late or missed (an email filter, a phone that&apos;s
          off), so please don&apos;t rely on it alone for anything critical.
        </p>
        <p>
          As far as the law allows, we&apos;re not responsible for indirect losses, or for a
          forgotten birthday. Nothing here limits rights you have under the law where you live.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        If we change these terms, we&apos;ll update this page and its date. For important changes,
        we&apos;ll tell you in the app or by email before they apply. Using Remember Me after that
        means you accept them; if you don&apos;t, you can delete your account.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Remember Me is an independent project made in Marrakech, Morocco, and these terms follow
        Moroccan law. Questions? <LegalLink href={CONTACT_MAILTO}>{CONTACT_EMAIL}</LegalLink>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of"
      serifWord="use"
      updated={TERMS_UPDATED}
      intro={
        <p>
          The simple rules for using Remember Me. By creating an account, you agree to them and to
          our{" "}
          <Link href="/privacy" className="font-semibold text-accent-text underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      }
      sections={sections}
    />
  );
}
