import {
  BellRingIcon,
  ChevronRightIcon,
  GiftIcon,
  KeyRoundIcon,
  type LucideIcon,
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AskNoorSection } from "@/features/ask-noor/components/ask-noor-section";
import { FeedbackForm } from "@/features/feedback/components/feedback-form";
import type { HelpSlug } from "@/features/help/slugs";
import { AppMain } from "@/features/shell/app-shell";
import { PageHeader, PageHeaderFallback } from "@/features/shell/page-header";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";
import { notificationsInboxEnabled } from "@/lib/flags";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import pkg from "../../../../package.json";

export const metadata: Metadata = { title: "Help & feedback · Remember Me" };

/** Browse help: six topics, each an article in the public help center. */
const TOPICS: { slug: HelpSlug; title: string; line: string; Icon: LucideIcon }[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    line: "Your first people and days",
    Icon: SparklesIcon,
  },
  { slug: "reminders", title: "Reminders", line: "When and how I remind you", Icon: BellRingIcon },
  {
    slug: "wishlists-and-reservations",
    title: "Wishlists and reservations",
    line: "Wishes, and keeping surprises",
    Icon: GiftIcon,
  },
  {
    slug: "invites-and-connections",
    title: "Invites and connections",
    line: "Connect with your people",
    Icon: UsersIcon,
  },
  {
    slug: "your-data-and-privacy",
    title: "Privacy and your data",
    line: "Who sees what, and your data",
    Icon: ShieldIcon,
  },
  {
    slug: "account-and-settings",
    title: "Account and sign-in",
    line: "Email, password and Google",
    Icon: KeyRoundIcon,
  },
];

const cardClass = "flex min-w-0 flex-col gap-4 rounded-card-lg bg-card p-6 shadow-card sm:p-8";

async function Header() {
  // The bell switch is read per request, after the session.
  await createSupabaseServerClient();
  return (
    <PageHeader
      title="Help & feedback"
      subtitle="Answers, guides, and a way to tell me anything"
      theme={false}
      bell={notificationsInboxEnabled()}
    />
  );
}

/**
 * Help & feedback (from the account menu; /help for signed-in people, see
 * src/proxy.ts): Ask Noor, six help topics, and Send feedback (saved in
 * `feedback`, emailed to us). Signed-out visitors get the public help center.
 */
export default function HelpAndFeedbackPage() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  return (
    <AppMain>
      <Suspense fallback={<PageHeaderFallback title="Help & feedback" />}>
        <Header />
      </Suspense>

      <div className="grid max-w-3xl min-w-0 gap-6">
        <Suspense fallback={null}>
          <section aria-label="Ask Noor" className={`${cardClass} empty:hidden`}>
            <AskNoorSection />
          </section>
        </Suspense>

        <section aria-labelledby="browse-help" className={cardClass}>
          <h2 id="browse-help" className="text-22 font-extrabold tracking-[-0.02em]">
            Browse help
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {TOPICS.map(({ slug, title, line, Icon }) => (
              <li key={slug}>
                <Link
                  href={`/help/${slug}`}
                  className="flex min-h-[72px] items-center gap-3.5 rounded-[20px] bg-card2 hover-tint px-4 py-3"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-card">
                    <Icon aria-hidden className="size-5 text-accent-text" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-15 font-bold">{title}</span>
                    <span className="text-13 text-sub">{line}</span>
                  </span>
                  <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-sub" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="send-feedback" className={cardClass}>
          <div className="flex flex-col gap-1">
            <h2 id="send-feedback" className="text-22 font-extrabold tracking-[-0.02em]">
              Send feedback
            </h2>
            <p className="text-15 text-sub">An idea, something broken, anything at all.</p>
          </div>
          <FeedbackForm />
        </section>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 text-14 text-sub">
          <a
            href={CONTACT_MAILTO}
            className="inline-flex min-h-11 items-center font-semibold text-accent-text underline-offset-4 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          <span>
            Version {pkg.version}
            {sha ? ` (${sha})` : ""}
          </span>
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            Terms
          </Link>
        </footer>
      </div>
    </AppMain>
  );
}
