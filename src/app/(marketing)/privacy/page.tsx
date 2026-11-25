/*
 * Privacy Policy template for this self-hostable application.
 * Customize it for each deployment and update PRIVACY_UPDATED
 * (src/features/legal/updated.ts) when the policy changes.
 *
 * NOTE: this text has not been reviewed by a lawyer. Have a legal
 * professional review it for the jurisdictions relevant to each deployment.
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
            so we never see it) or your third-party sign-in, your first name, your birthday (day and
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
            links you create. We keep each link so you can copy it again; only you can see it, and
            we look links up by a scrambled fingerprint.
          </li>
          <li>
            <strong>Reservations:</strong> which of a friend&apos;s wishes you reserved, and when.
          </li>
          <li>
            <strong>Birthday plans and notes:</strong> your plan steps and notes, and your note to
            future you.
          </li>
          <li>
            <strong>Older saved data:</strong> an installation upgraded from an earlier version may
            retain gift-suggestion results and message text saved on plan steps. The current app no
            longer creates or displays these, but includes any remaining values (including the
            occasion, ideas, and saved message text) in your data export while their associated
            records exist. Deleting a person or account may also delete associated legacy data
            through database cascade rules. Any separate cleanup of retained legacy schema or data
            is operator-managed, opt-in, and should be preceded by an appropriate backup.
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
            <strong>Ask Noor:</strong> when you ask Noor a question, we keep only how many questions
            you asked today (for the daily limit), never the question or the answer. Those counts go
            after 30 days.
          </li>
          <li>
            <strong>Notifications in the app:</strong> the bell keeps your last 30 days of
            reminders, accepted invites, and how many wishes your connections added to their shared
            birthday lists (you can turn those off in Settings). Never anything about reservations
            on your own lists. They&apos;re deleted after 30 days.
          </li>
          <li>
            <strong>Feedback:</strong> when you send feedback from Help &amp; feedback, we keep what
            you wrote and its type, and email it to us so we can read it and reply to your address.
            If you leave &ldquo;Include page and device info&rdquo; on, it also holds your browser,
            screen size and the section of the app you were on, never your people, wishes or names.
            You can send up to 5 a day; you can&apos;t read them back in the app.
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
          <li>
            your birthday&apos;s day and month, unless you turn that off in Settings, Privacy;
          </li>
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
          Remember Me is self-hostable, so its infrastructure and data processors vary by
          installation. The operator of each instance is responsible for identifying and documenting
          its hosting, database, authentication, storage, email, monitoring, analytics, AI and push
          services; what each processes; where processing takes place; and the applicable retention
          and privacy terms. Contact the operator for details about this instance.
        </p>
        <LegalList>
          <li>
            <strong>Database and application hosting:</strong> the operator selects and configures
            the services used for the website, database, sign-in, photo storage and scheduled jobs.
            Their locations and logging practices depend on that deployment.
          </li>
          <li>
            <strong>Email delivery:</strong> local development captures email without delivering it.
            A hosted instance may use an email provider selected by its operator.
          </li>
          <li>
            <strong>Optional monitoring and analytics:</strong> integrations may process technical
            error details or anonymous page views, depending on the deployment and its
            configuration. The operator should document which services are enabled for this
            instance.
          </li>
          <li>
            <strong>Third-party sign-in:</strong> if enabled, the selected identity provider returns
            your name and email.
          </li>
          <li>
            <strong>Optional Noor assistance:</strong> when enabled, your question and matching help
            passages are sent to the configured AI provider to write an answer. The provider does
            not receive your name, email or people, and the question and answer are not stored by
            the application. If no help passage matches, nothing is sent. The operator should
            document the selected provider and its data practices.
          </li>
          <li>
            <strong>Push delivery:</strong> if enabled, the push service selected by your browser or
            device vendor delivers notifications. Each message is encrypted so only your device can
            read it.
          </li>
        </LegalList>
        <p>
          This source code does not define a universal hosting region or provider. Before operating
          a hosted instance, customize this notice with the actual services, processing locations,
          retention practices, applicable terms and operator contact details. Hosting providers may
          keep technical logs, including IP addresses, according to their own settings.
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
            show which address to check after signing up, and pace the resend button (30 minutes and
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
          <strong>Anonymous page counts (deployment-dependent).</strong> If the configured hosting
          setup enables analytics, the integration sends a sanitized page path, referrer, and
          country, browser and device categories to the analytics service. It uses no cookies and
          respects Global Privacy Control and Do Not Track signals. The operator should document
          whether analytics is enabled and identify the provider and its data practices.
        </p>
        <p>
          Whether a consent notice is required depends on the deployment and applicable law. Each
          operator should assess this before launch.
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
          <li>
            invites: a day after they expire (7 days after they&apos;re made); your personal link, a
            day after you reset it;
          </li>
          <li>sign-up notices: after 30 days;</li>
          <li>the reminder log: after 400 days;</li>
          <li>push subscriptions: when you log out on that device or turn push off.</li>
        </LegalList>
        <p>
          <strong>Deleting your account removes everything at once:</strong> your profile, people,
          days, wishes, photos, plans, notes, connections, reservations, devices and the feedback
          you sent. Copies in our database provider&apos;s backups disappear when those backups
          expire.
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
          These controls are available in the app. Privacy laws may provide additional rights or
          require different response times. Each instance operator should adapt this section to the
          laws applicable to the deployment and its users, including the relevant supervisory
          authority.
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
            <LegalLink href={CONTACT_MAILTO}>{CONTACT_EMAIL}</LegalLink>. Each instance operator
            should customize the contact and response time for this deployment. You can also contact
            the data protection authority responsible for your location.
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
