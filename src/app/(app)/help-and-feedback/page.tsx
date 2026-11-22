import {
  BellRingIcon,
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
import { notificationsInboxEnabled } from "@/lib/flags";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import pkg from "../../../../package.json";

export const metadata: Metadata = { title: "Help & feedback · Remember Me" };

/** Browse help: six topics, each an article in the public help center. */
const TOPICS: { slug: HelpSlug; title: string; line: string; Icon: LucideIcon }[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    line: "Add people, dates and your first wish",
    Icon: SparklesIcon,
  },
  {
    slug: "reminders",
    title: "Reminders",
    line: "When and how Noor nudges you",
    Icon: BellRingIcon,
  },
  {
    slug: "wishlists-and-reservations",
    title: "Wishlists and reservations",
    line: "How secret reservations stay secret",
    Icon: GiftIcon,
  },
  {
    slug: "invites-and-connections",
    title: "Invites and connections",
    line: "Bring your people in",
    Icon: UsersIcon,
  },
  {
    slug: "your-data-and-privacy",
    title: "Privacy and your data",
    line: "Who sees what, export, delete",
    Icon: ShieldIcon,
  },
  {
    slug: "account-and-settings",
    title: "Account and sign-in",
    line: "Email, password, Google",
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
 * src/proxy.ts): Ask Noor (peach card), Browse help (six topic cards on the
 * page background), Send feedback (saved in `feedback`, emailed to us) and a
 * footer (name, version, Privacy, Terms). Signed-out visitors get the public
 * help center.
 */
export default function HelpAndFeedbackPage() {
  return (
    <AppMain>
      <Suspense fallback={<PageHeaderFallback title="Help & feedback" />}>
        <Header />
      </Suspense>

      <div className="grid max-w-3xl min-w-0 gap-6">
        <Suspense fallback={null}>
          <section
            aria-label="Ask Noor"
            className="flex min-w-0 flex-col gap-4 rounded-card-lg bg-[linear-gradient(160deg,var(--peach),var(--card))] p-6 shadow-card empty:hidden sm:p-8"
          >
            <AskNoorSection />
          </section>
        </Suspense>

        {/* On the page background, not in a card: the topics are the cards. */}
        <section aria-labelledby="browse-help" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h2 id="browse-help" className="text-[20px] font-extrabold tracking-[-0.02em]">
              Browse help
            </h2>
            <Link
              href="/help?center"
              className="inline-flex min-h-11 items-center text-14 font-bold text-accent-text underline-offset-4 hover:underline"
            >
              Open help center
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOPICS.map(({ slug, title, line, Icon }) => (
              <li key={slug} className="flex">
                <Link
                  href={`/help/${slug}`}
                  className="flex min-h-11 w-full gap-3 rounded-[22px] bg-card hover-tint p-4 shadow-card transition-transform duration-200 ease-soft hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))]">
                    <Icon aria-hidden className="size-[18px] text-accent-text" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-15 font-bold">{title}</span>
                    <span className="text-13 text-sub">{line}</span>
                  </span>
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

        <footer className="flex flex-wrap items-center gap-x-2 text-14 text-sub">
          <span>Remember Me</span>
          <span aria-hidden="true">·</span>
          <span>Version {pkg.version}</span>
          <span aria-hidden="true">·</span>
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
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
