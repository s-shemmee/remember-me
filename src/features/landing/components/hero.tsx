import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Noor } from "@/components/ui/noor";
import { cn } from "@/lib/utils";

import { HERO_HEADING, HERO_LEAD, HERO_WORDS, SIGN_UP_NOTE } from "../content";

/**
 * The hero (S1Hero). The h1 is plain text (the page's LCP element): screen
 * readers get one static sentence; the moving words are decorative. They go
 * once through four phrases in under 5 seconds and rest on "own". The pen
 * line draws once. Nothing else moves.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-10 px-4 pt-10 pb-12 sm:px-8 lg:pt-[72px]"
    >
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-7">
        <h1
          id="hero-heading"
          className="text-[40px] leading-[1.1] font-extrabold tracking-[-0.035em] sm:text-48 lg:text-64"
        >
          <span className="sr-only">{HERO_HEADING}</span>
          <span aria-hidden>
            Never forget your
            <span className="block h-[1.1em] overflow-hidden">
              <span className="flex animate-words flex-col font-serif font-normal tracking-[-0.01em] text-accent-text italic">
                {HERO_WORDS.map((w) => (
                  <span key={w} className="block h-[1.1em] whitespace-nowrap">
                    {w}
                  </span>
                ))}
              </span>
            </span>
            special day.
          </span>
        </h1>
        <svg
          width="330"
          height="26"
          viewBox="0 0 330 26"
          aria-hidden
          className="-mt-7 h-auto max-w-[80%]"
        >
          <path
            className="animate-draw"
            d="M4 16 C 70 6, 160 4, 240 11 S 310 20, 326 9"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <p className="max-w-[460px] text-[18px] leading-[1.55] text-sub sm:text-19">{HERO_LEAD}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="px-[26px]">
            <Link href="/sign-up">Start remembering</Link>
          </Button>
          <Button asChild size="lg" variant="card2" className="px-[22px]">
            <a href="#how">See how it works</a>
          </Button>
        </div>
        <div className="-mt-3 ml-10 flex items-start gap-1.5">
          <svg width="40" height="36" viewBox="0 0 40 36" aria-hidden className="shrink-0">
            <path
              d="M32 33 C 34 22, 28 12, 14 5 M14 5 L 15 14 M14 5 L 23 4"
              fill="none"
              stroke="var(--sub)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="mt-3.5 -rotate-2 font-hand text-[19px] text-sub">{SIGN_UP_NOTE}</span>
        </div>
      </div>
      <HeroCollage />
    </section>
  );
}

/** On wide screens: absolute, as in the design. On phones: the same pieces in a column. */
const at = (desktop: string) => cn("relative lg:absolute", desktop);

function HeroCollage() {
  return (
    <figure className="relative flex w-full min-w-0 flex-col gap-6 lg:block lg:h-[720px] lg:w-auto lg:flex-[0_1_620px]">
      {/* The reminder */}
      <div
        className={at(
          "flex w-full max-w-[430px] gap-3 rounded-[22px] bg-card px-4 py-3.5 font-system shadow-card lg:top-2.5 lg:left-[70px] lg:w-[430px]",
        )}
      >
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-peach text-[22px]"
        >
          🎂
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="flex justify-between text-12 font-semibold tracking-[.04em] text-sub">
            <span>REMEMBER ME</span>
            <span className="font-normal tracking-normal">now</span>
          </span>
          <span className="text-15 font-bold">Sara&apos;s birthday is tomorrow</span>
          <span className="text-14 text-sub">She&apos;d love the Instax from her wishlist 📸</span>
        </span>
      </div>

      {/* The date, circled */}
      <div
        aria-hidden
        className="hidden size-44 -rotate-3 flex-col items-center justify-center rounded-[30px] bg-card shadow-card lg:absolute lg:top-[150px] lg:left-0 lg:flex"
      >
        <span className="text-13 font-bold tracking-[.06em] text-accent-text">TUESDAY</span>
        <span className="text-[84px] leading-none font-light tracking-[-0.04em]">3</span>
        <span className="text-14 font-medium text-sub">March</span>
        <svg width="130" height="104" viewBox="0 0 130 104" className="absolute top-[30px] left-6">
          <path
            className="animate-draw [--draw-delay:1.6s]"
            d="M74 10 C 26 6, 6 38, 18 64 C 32 92, 104 94, 120 62 C 132 36, 112 8, 70 9 C 54 10, 42 16, 34 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* The wish, secretly reserved */}
      <div
        className={at(
          "mx-3 mb-8 w-auto lg:top-[160px] lg:left-[220px] lg:mx-0 lg:mb-0 lg:w-[270px]",
        )}
      >
        <div className="flex flex-col gap-2 rounded-[24px] bg-mint p-[18px] text-mint-ink">
          <span aria-hidden className="text-[44px] leading-none">
            📸
          </span>
          <span className="text-[18px] font-bold">Instax mini 12</span>
          <span className="text-14 font-medium">790 MAD · Sara&apos;s wishlist</span>
        </div>
        <SelectionFrame label="secretly reserved by you 🤫" />
      </div>

      <span
        aria-hidden
        className="hidden rotate-12 text-[52px] drop-shadow-[0_3px_6px_rgba(0,0,0,.18)] lg:absolute lg:top-[120px] lg:left-[530px] lg:block"
      >
        🎁
      </span>
      <span
        aria-hidden
        className="hidden -rotate-10 text-[40px] drop-shadow-[0_3px_6px_rgba(0,0,0,.15)] lg:absolute lg:top-[380px] lg:left-5 lg:block"
      >
        🎈
      </span>

      {/* The thank-you */}
      <div
        className={at(
          "flex w-full max-w-[380px] flex-col gap-2 self-end font-system lg:top-[400px] lg:left-[110px] lg:w-[380px]",
        )}
      >
        <span className="max-w-[260px] self-start rounded-[20px_20px_20px_6px] bg-bubble px-3.5 py-2.5 text-16">
          wait… you remembered?? 🥹
        </span>
        <span className="max-w-[280px] self-end rounded-[20px_20px_6px_20px] bg-[#0060df] px-3.5 py-2.5 text-16 text-[#ffffff]">
          always!! happy birthday Sara 🎉 check your door
        </span>
        <span className="self-end text-12 text-sub">Delivered</span>
      </div>

      <div className="flex flex-wrap items-end gap-4 lg:contents">
        {/* Your own day */}
        <div
          className={at(
            "flex flex-col gap-0.5 rounded-[22px] bg-lilac px-4 py-3.5 text-lilac-ink lg:top-[600px] lg:left-10",
          )}
        >
          <span className="text-12 font-bold">Celebrate Me</span>
          <span className="text-[26px] font-extrabold tracking-[-0.02em]">12 days</span>
        </div>
        <div
          className={at(
            "w-[250px] max-w-full rotate-3 rounded-[6px] bg-butter px-5 py-[18px] shadow-[0_10px_24px_rgba(0,0,0,.10)] lg:top-[570px] lg:left-[330px]",
          )}
        >
          <span className="font-hand text-[22px] leading-[1.15] font-bold text-butter-ink">
            and don&apos;t forget your own day too ✨
          </span>
        </div>
      </div>

      {/* Noor, peeking */}
      <div
        className={at(
          "flex flex-col items-center gap-1 self-end lg:top-[520px] lg:left-[566px] lg:self-auto",
        )}
      >
        <span className="rounded-[14px_14px_14px_4px] bg-bubble px-2.5 py-1.5 font-system text-13 whitespace-nowrap">
          hi, I&apos;m Noor 👋
        </span>
        <Noor size={52} />
      </div>
    </figure>
  );
}

/** The blue selection box from the design, with its label. */
export function SelectionFrame({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden className="absolute -inset-2 rounded-[30px] border-[1.5px] border-select" />
      {(
        ["-top-3 -left-3", "-top-3 -right-3", "-bottom-3 -left-3", "-bottom-3 -right-3"] as const
      ).map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={cn("absolute size-2 border-[1.5px] border-select bg-card", pos)}
        />
      ))}
      <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 rounded-[6px] bg-[#2f5bd3] px-2 py-[3px] text-12 font-semibold whitespace-nowrap text-[#ffffff]">
        {label}
      </span>
    </>
  );
}
