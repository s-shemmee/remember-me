import type { Metadata } from "next";
import Link from "next/link";

import { getHelpArticles } from "@/features/help/articles";
import { LandingFooter, LandingHeader } from "@/features/landing/components/chrome";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Help · Remember Me",
  description:
    "How Remember Me works: people and their days, reminders, wishlists and secret reservations, invites, plans, your data and your account.",
  alternates: { canonical: "/help" },
};

/** /help: the help articles (docs/help/*.md), one card each. */
export default function HelpIndexPage() {
  const articles = getHelpArticles();
  return (
    <>
      <LandingHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-8 px-4 pt-10 pb-16 sm:px-8 sm:pt-14">
          <header className="flex flex-col gap-3">
            <h1 className="text-34 leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-44">
              How can we{" "}
              <span className="font-serif font-normal text-accent-text italic">help?</span>
            </h1>
            <p className="text-17 leading-relaxed text-sub">
              Short guides to everything in Remember Me. Can&apos;t find your answer? Write to{" "}
              <a
                href={CONTACT_MAILTO}
                className="font-semibold text-accent-text underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </header>
          <ul className="grid gap-4 sm:grid-cols-2">
            {articles.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/help/${a.slug}`}
                  className="flex h-full flex-col gap-2 rounded-card bg-card hover-tint p-5 shadow-card transition-transform duration-200 ease-soft hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
                >
                  <h2 className="text-19 font-extrabold tracking-[-0.02em]">{a.title}</h2>
                  <p className="line-clamp-3 text-15 leading-normal text-sub">{a.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
