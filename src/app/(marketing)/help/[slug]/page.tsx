import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getHelpArticle } from "@/features/help/articles";
import { HelpContent } from "@/features/help/help-content";
import { HELP_SLUGS, isHelpSlug } from "@/features/help/slugs";
import { LandingFooter, LandingHeader } from "@/features/landing/components/chrome";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";

/** The articles in docs/help/, prerendered; any other slug is a 404 (below). */
export function generateStaticParams() {
  return HELP_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/help/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isHelpSlug(slug)) return {};
  const a = getHelpArticle(slug);
  return {
    title: `${a.title} · Remember Me Help`,
    description: a.description,
    alternates: { canonical: `/help/${slug}` },
  };
}

export default async function HelpArticlePage({ params }: PageProps<"/help/[slug]">) {
  const { slug } = await params;
  if (!isHelpSlug(slug)) notFound();
  const article = getHelpArticle(slug);
  const index = HELP_SLUGS.indexOf(slug);
  const next = HELP_SLUGS[index + 1];
  const nextArticle = next ? getHelpArticle(next) : null;

  return (
    <>
      <LandingHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <article className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pt-8 pb-16 sm:px-8 sm:pt-12">
          <nav aria-label="Breadcrumb" className="text-15">
            <Link
              href="/help"
              className="inline-flex min-h-11 items-center font-semibold text-accent-text underline-offset-2 hover:underline"
            >
              <span aria-hidden>←&nbsp;</span>All help articles
            </Link>
          </nav>
          <h1 className="text-34 leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-44">
            {article.title}
          </h1>
          <HelpContent blocks={article.blocks} />
          <footer className="mt-6 flex flex-col gap-4 border-t border-line pt-6 text-15 text-sub">
            {nextArticle && (
              <p>
                Next:{" "}
                <Link
                  href={`/help/${nextArticle.slug}`}
                  className="font-semibold text-accent-text underline underline-offset-2"
                >
                  {nextArticle.title}
                </Link>
              </p>
            )}
            <p>
              Still stuck? Write to{" "}
              <a
                href={CONTACT_MAILTO}
                className="font-semibold text-accent-text underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </footer>
        </article>
      </main>
      <LandingFooter />
    </>
  );
}
