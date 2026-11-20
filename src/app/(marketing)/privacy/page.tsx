/*
 * Privacy Policy. Written to match what the app actually does (checked
 * against the code, migrations and clean-up jobs in fix/launch-prep, Nov 2026).
 * Change it whenever a feature that touches personal data changes, and bump
 * PRIVACY_UPDATED (src/features/legal/updated.ts).
 *
 * NOTE: this text has not been reviewed by a lawyer. Have a legal
 * professional review it (Morocco's law 09-08 / CNDP, and GDPR for EU users)
 * before scaling beyond a small group of users.
 */
import type { Metadata } from "next";

import { LegalLink, LegalList, LegalPage, type LegalSection } from "@/features/legal/legal-page";
import { PRIVACY_UPDATED } from "@/features/legal/updated";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Privacy Policy · Remember Me",
  description:
    "What Remember Me keeps, why, who helps us run it, how long we keep it, and your rights. No ads, no tracking cookies.",
  alternates: { canonical: "/privacy" },
};

const sections: LegalSection[] = [
  {
    id: "what-we-collect",
    title: "What we keep",
    body: (
      <>
        <p>Only what the app needs to work. Specifically:</p>
        <LegalList>
          <li>
            <strong>Your account:</strong> your email, your password (stored only as a secure hash,
            so we never see it) or your Google sign-in, your first name, your birthday (day and
            month, and the year if you add it), your look (initials and colour, a character, or a
            photo), your time zone, your theme, and whether your connections can see your birthday.
          </li>
          <li>
            <strong>The people and days you add:</strong> names, how you know them, a colour,
            &ldquo;little things&rdquo; they love, whether they&apos;re &ldquo;In memory&rdquo;, and
            their days (birthdays, anniversaries, graduations, work milestones, remembrance days and
            others).
          </li>
          <li>
            <strong>Wishes:</strong> each wish&apos;s title, link, price, note, how much you want
            it, and a photo if you add one.
          </li>
          <li>
            <strong>Connections and invites:</strong> who you&apos;re connected with, and the invite
            links you create (we keep only a scrambled fingerprint of each link, never the link
            itself).
          </li>
          <li>
            <strong>Reservations:</strong> which of a friend&apos;s wishes you reserved, and when.
          </li>
          <li>
            <strong>Birthday plans and notes:</strong> your plan steps and notes, and your note to
            future you.
          </li>
          <li>
            <strong>Reminders and notifications:</strong> your reminder settings; for push, the
            subscription your browser gives us and a device name like &ldquo;Chrome on
            Android&rdquo;; and a log of the reminders we sent (which day, when, by email or push),
            so we never send one twice.
          </li>
          <li>
            <strong>Quiet notes:</strong> small messages in the app, like &ldquo;Khalid removed a
            wish you&apos;d reserved&rdquo;.
          </li>
          <li>
            <strong>Sign-up notices:</strong> if someone tries to sign up with an email that already
            has an account, we email that address (at most once an hour). To do that, we keep a
            scrambled fingerprint of the address (not the address) for 30 days.
          </li>
          <li>
            <strong>Ask Noor:</strong> when you ask Noor a question in Settings, we keep only how
            many questions you asked today (for the daily limit), never the question or the answer.
            Those counts go after 30 days.
          </li>
        </LegalList>
        <p>
          Photos are made smaller and re-saved on your device before they&apos;re uploaded, so
          location and camera details never leave your phone. We don&apos;t collect your location,
          contacts or anything from other apps.
        </p>
      </>
    ),
  },
  {
    id: "people-you-add",
    title: "The people you add",
    body: (
      <>
        <p>
          Remember Me holds details about people who may not use it themselves: a friend&apos;s
          name, birthday and the little things they love. We treat that with care.
        </p>
        <LegalList>
          <li>
            It&apos;s private to you. Nobody else can see your people, not even your connections.
          </li>
          <li>We never share it, sell it, or use it for marketing or ads.</li>
          <li>
            The people you add aren&apos;t told and get nothing from us, unless you send them an
            invite yourself.
          </li>
          <li>Only add what someone would be happy for a friend to remember.</li>
        </LegalList>
        <p>
          If you think someone has added your details and you&apos;d like them removed, write to{" "}
          <LegalLink href={CONTACT_MAILTO}>{CONTACT_EMAIL}</LegalLink>. We&apos;ll look into it and
          reply within 30 days.
        </p>
      </>
    ),
  },
  {
    id: "who-sees-what",
    title: "What your connections see",
    body: (
      <>
        <p>When you and a friend connect (both of you agree, through an invite), they can see:</p>
        <LegalList>
          <li>your first name and your look (including your photo, if you have one);</li>
          <li>your birthday&apos;s day and month, unless you turn that off in your profile;</li>
          <li>your &ldquo;My birthday&rdquo; wishlist.</li>
        </LegalList>
        <p>
          They never see your birth year, email, time zone, your people, your plans or your notes.
          Your &ldquo;Treat yourself&rdquo; list stays private. When a friend reserves one of your
          wishes, you&apos;re never told who, so the surprise holds. You can remove a connection at
          any time.
        </p>
      </>
    ),
  },
  {
    id: "who-helps",
    title: "Who helps us run it",
    body: (
      <>
        <p>
          A few trusted services process data for us, only to run Remember Me. Your data is stored
          in the European Union:
        </p>
        <LegalList>
          <li>
            <strong>Supabase</strong>: our database, sign-in, photo storage and scheduled jobs.
            Ireland (eu-west-1).
          </li>
          <li>
            <strong>Vercel</strong>: hosts the website. Our server code runs in Dublin, Ireland
            (dub1); pages may be delivered from Vercel&apos;s servers nearest to you. Vercel Web
            Analytics also counts page views for us, anonymously (see{" "}
            <LegalLink href="#cookies">Cookies and storage</LegalLink>).
          </li>
          <li>
            <strong>Resend</strong>: sends our emails (confirmations, reminders). Ireland
            (eu-west-1).
          </li>
          <li>
            <strong>Sentry</strong>: tells us when something breaks, with technical details like the
            page, browser and error. No session recordings, and no name or email. Germany (EU).
          </li>
          <li>
            <strong>Google</strong>: only if you choose &ldquo;Continue with Google&rdquo;. Google
            tells us your name and email.
          </li>
          <li>
            <strong>Groq</strong>, and <strong>Cloudflare</strong> as a backup: when you ask Noor a
            question, your question and the help text that matches it are sent to them to write
            Noor&apos;s answer. They don&apos;t get your name, email or any of your people, and we
            don&apos;t store the question or the answer. If nothing in our help matches, nothing is
            sent at all.
          </li>
          <li>
            <strong>Your browser&apos;s push service</strong> (Google, Mozilla, Apple or Microsoft):
            delivers push notifications if you turn them on. Each message is encrypted so only your
            device can read it.
          </li>
        </LegalList>
        <p>
          Some of these companies are based in the United States; each protects data under its own
          data protection terms. Our hosting and database providers also keep short-lived technical
          logs (which can include your IP address) to keep the service running and secure.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and storage",
    body: (
      <>
        <p>
          <strong>No tracking cookies, no ads.</strong> We only store what the app needs to work:
        </p>
        <LegalList>
          <li>
            <strong>Sign-in cookies</strong> (named <code>sb-…-auth-token</code>) keep you logged
            in.
          </li>
          <li>
            <strong>
              <code>rm-invite</code>
            </strong>{" "}
            remembers an invite you opened before signing up, for up to 7 days.
          </li>
          <li>
            <strong>
              <code>rm-pending-email</code>
            </strong>{" "}
            and{" "}
            <strong>
              <code>rm-resend-at</code>
            </strong>{" "}
            show which address to check after signing up, and pace the Resend button (30 minutes and
            1 minute).
          </li>
          <li>
            <strong>On your device only:</strong> your theme (<code>rm-theme</code>,{" "}
            <code>rm-theme-user</code>), when Noor&apos;s offer was put off until tomorrow (
            <code>rm-noor-later</code>), your onboarding answers until you finish (cleared when the
            tab closes), and the app&apos;s own files so it opens offline (never your data).
          </li>
        </LegalList>
        <p>
          <strong>Anonymous page counts.</strong> To see which pages are used, Vercel Web Analytics
          counts page views: which page (with every link code and ID removed first, so never an
          invite, a reset link or a person), the site you came from, and your country, browser and
          device type. It uses no cookies and stores nothing on your device. Visitors are counted
          with an anonymous code that changes every day, never your IP address, and we only ever see
          totals. If your browser sends Global Privacy Control or Do Not Track, your visits
          aren&apos;t counted at all.
        </p>
        <p>
          Because all of this is strictly necessary or anonymous, there&apos;s no cookie banner.
        </p>
      </>
    ),
  },
  {
    id: "how-long",
    title: "How long we keep it",
    body: (
      <>
        <p>Your data stays while you have an account. Some things go sooner, automatically:</p>
        <LegalList>
          <li>people you removed: after 30 days;</li>
          <li>wishes you removed: after 30 days, with their photo;</li>
          <li>cancelled reservations: after 10 minutes;</li>
          <li>invites: a day after they expire (7 days after they&apos;re made);</li>
          <li>sign-up notices: after 30 days;</li>
          <li>the reminder log: after 400 days;</li>
          <li>push subscriptions: when you log out on that device or turn push off.</li>
        </LegalList>
        <p>
          <strong>Deleting your account removes everything at once:</strong> your profile, people,
          days, wishes, photos, plans, notes, connections, reservations and devices. Copies in our
          database provider&apos;s backups disappear when those backups expire.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>
          Under Morocco&apos;s law 09-08 on personal data, and in the spirit of the EU&apos;s GDPR,
          you can:
        </p>
        <LegalList>
          <li>
            <strong>See and take your data:</strong> Settings, Your data, &ldquo;Download my
            data&rdquo; gives you everything in one file.
          </li>
          <li>
            <strong>Correct it:</strong> edit anything in the app, at any time.
          </li>
          <li>
            <strong>Delete it:</strong> Settings, Your data, &ldquo;Delete my account&rdquo;.
          </li>
          <li>
            <strong>Say no:</strong> turn off email or push reminders, or hide your birthday from
            your connections.
          </li>
          <li>
            <strong>Ask us anything or complain:</strong> write to{" "}
            <LegalLink href={CONTACT_MAILTO}>{CONTACT_EMAIL}</LegalLink>. We reply within 30 days.
            You can also contact Morocco&apos;s data protection authority, the CNDP (
            <LegalLink href="https://www.cndp.ma">cndp.ma</LegalLink>), or the authority where you
            live.
          </li>
        </LegalList>
      </>
    ),
  },
  {
    id: "age",
    title: "Age",
    body: <p>Remember Me is for people aged 16 and over.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        If we change how we use your data, we&apos;ll update this page and its date. For anything
        important, we&apos;ll tell you in the app or by email before it applies.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Remember Me is a small, independent project, made so the people you love are never
        forgotten. Questions about your data:{" "}
        <LegalLink href={CONTACT_MAILTO}>{CONTACT_EMAIL}</LegalLink>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      serifWord="Policy"
      updated={PRIVACY_UPDATED}
      intro={
        <p>
          Remember Me helps you remember the people you love. Here&apos;s what we keep to do that,
          in plain words. In short: only what the app needs, private to you unless you choose to
          share, never sold, and you can take it or delete it at any time.
        </p>
      }
      sections={sections}
    />
  );
}
