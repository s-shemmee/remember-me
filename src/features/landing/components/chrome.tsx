import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import { CONTACT_EMAIL } from "../content";

/** Absolute ("/#…") so the header and footer also work on /privacy and /terms. */
const SECTIONS = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/#noor", label: "Meet Noor" },
  { href: "/#faq", label: "FAQ" },
] as const;

/** Sticky glass header (S1Hero): logo, section links, theme, Log in, Sign up. */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-glass backdrop-blur-xl backdrop-saturate-[1.8]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-2 sm:px-8 sm:py-3">
        {/* Under 360px only the heart square shows (the link keeps its name). */}
        <Logo
          href="/"
          label="Remember me, home"
          className="max-[359px]:[&>span:last-child]:hidden"
        />
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex gap-1">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  className="inline-flex min-h-11 items-center rounded-pill hover-tint px-3.5 text-15 font-medium text-sub transition-colors duration-200 ease-soft hover:text-text"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Button asChild variant="transparent" className="px-3 sm:px-[18px]">
            <Link href="/log-in">Log in</Link>
          </Button>
          <Button asChild className="px-4 sm:px-[18px]">
            <Link href="/sign-up">
              <span className="sm:hidden">Sign up</span>
              <span className="hidden sm:inline">Sign up free</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

const FOOTER_LINK =
  "inline-flex min-h-11 min-w-11 items-center text-15 text-sub underline-offset-4 hover:text-text hover:underline";

/** Footer (S3Rest): logo, tagline, link columns, "Made with 🤍". */
export function LandingFooter() {
  return (
    <footer className="border-t border-line bg-card below-fold">
      <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-10 px-4 pt-12 pb-8 sm:px-8">
        <div className="flex max-w-[320px] flex-col gap-3">
          <Logo href={null} label="Remember me" />
          <p className="text-15 leading-normal text-sub">
            Because everyone deserves to be remembered. Including you.
          </p>
          <ThemeToggle className="sm:hidden" />
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-12 gap-y-6">
          <FooterColumn title="Product">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a href={s.href} className={FOOTER_LINK}>
                  {s.label}
                </a>
              </li>
            ))}
          </FooterColumn>
          <FooterColumn title="Company">
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className={FOOTER_LINK}>
                Contact
              </a>
            </li>
          </FooterColumn>
          <FooterColumn title="Legal">
            <li>
              <Link href="/privacy" className={FOOTER_LINK}>
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className={FOOTER_LINK}>
                Terms
              </Link>
            </li>
          </FooterColumn>
        </nav>
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-2 border-t border-line px-4 pt-5 pb-7 text-13 text-sub sm:px-8">
        <span>© 2026 Remember Me</span>
        <span>
          Made with <span aria-label="love">🤍</span> in Marrakech
        </span>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `footer-${title.toLowerCase()}`;
  return (
    <div className="flex min-w-[140px] flex-col gap-1">
      <h2 id={id} className="text-13 font-bold tracking-[.05em] uppercase">
        {title}
      </h2>
      <ul aria-labelledby={id}>{children}</ul>
    </div>
  );
}
