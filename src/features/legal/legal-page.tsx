import type * as React from "react";

import { LandingFooter, LandingHeader } from "@/features/landing/components/chrome";

export type LegalSection = {
  /** The anchor, e.g. "what-we-collect". */
  id: string;
  title: string;
  body: React.ReactNode;
};

/**
 * Long-form legal page (/privacy, /terms): the landing header and footer, a
 * title with one serif word, the last-updated date, "On this page" links and
 * plain sections. Server only, no motion.
 */
export function LegalPage({
  title,
  serifWord,
  updated,
  intro,
  sections,
}: {
  /** The title without its last word, e.g. "Privacy". */
  title: string;
  /** The last word, in Instrument Serif italic, e.g. "Policy". */
  serifWord: string;
  /** ISO date, e.g. "2026-11-19". */
  updated: string;
  intro: React.ReactNode;
  sections: LegalSection[];
}) {
  const updatedLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${updated}T00:00:00Z`));

  return (
    <>
      <LandingHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <article className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 pt-10 pb-16 sm:px-8 sm:pt-14">
          <header className="flex flex-col gap-3">
            <h1 className="text-34 leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-44">
              {title}{" "}
              <span className="font-serif font-normal text-accent-text italic">{serifWord}</span>
            </h1>
            <p className="text-15 text-sub">
              Last updated <time dateTime={updated}>{updatedLabel}</time>
            </p>
            <div className="flex flex-col gap-3 text-17 leading-relaxed">{intro}</div>
          </header>

          <nav aria-labelledby="on-this-page" className="rounded-card bg-card p-5 shadow-card sm:p-6">
            <h2 id="on-this-page" className="mb-2 text-15 font-bold text-sub">
              On this page
            </h2>
            <ol className="grid gap-x-6 sm:grid-cols-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="hover-tint -mx-2 flex min-h-11 items-center rounded-item px-2 text-15 font-semibold text-accent-text underline-offset-2 hover:underline"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {sections.map((s) => (
            <section key={s.id} aria-labelledby={s.id} className="flex scroll-mt-24 flex-col gap-3">
              <h2 id={s.id} className="scroll-mt-24 text-22 font-extrabold tracking-[-0.02em]">
                {s.title}
              </h2>
              <div className="flex flex-col gap-3 text-16 leading-relaxed">{s.body}</div>
            </section>
          ))}
        </article>
      </main>
      <LandingFooter />
    </>
  );
}

/** A plain bulleted list for legal text. */
export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-6 marker:text-sub">{children}</ul>;
}

/** An inline link in legal text (underlined, accent text: 4.5:1 in both themes). */
export function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="font-semibold text-accent-text underline underline-offset-2">
      {children}
    </a>
  );
}
