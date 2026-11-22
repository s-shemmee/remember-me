import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Noor } from "@/components/ui/noor";
import { cn } from "@/lib/utils";

import { CONTACT_EMAIL, FAQ, SIGN_UP_NOTE } from "../content";
import { Accent, Eyebrow } from "./features";

const STEPS = [
  {
    title: "Add your people",
    text: "Type a name and their birthday. Give each one a colour.",
    tint: "bg-peach",
    visual: (
      <div className="flex -rotate-2 items-center gap-2.5 rounded-pill bg-card py-2.5 pr-4 pl-2.5 font-system shadow-card">
        <span className="grid size-10 place-items-center rounded-full bg-peach text-14 font-extrabold text-peach-ink">
          SA
        </span>
        <span className="flex flex-col">
          <span className="text-15 font-bold">Sara</span>
          <span className="text-13 text-sub">best friend</span>
        </span>
        <span className="ml-1.5 rounded-pill bg-mint px-2 py-[3px] text-12 font-bold text-mint-ink">
          + added
        </span>
      </div>
    ),
  },
  {
    title: "Save their days and wishes",
    text: "Birthdays, anniversaries, little notes. Or invite them, and their wishlist comes along.",
    tint: "bg-lilac",
    visual: (
      <div className="flex flex-col items-center gap-2 font-system">
        <span className="rotate-2 rounded-pill bg-card px-3.5 py-2 text-15 font-bold shadow-card">
          🎂 Tue, 3 March
        </span>
        <span className="-rotate-2 rounded-pill bg-card px-3.5 py-2 text-15 font-semibold shadow-card">
          🌻 loves sunflowers
        </span>
      </div>
    ),
  },
  {
    title: "Noor reminds you, gently",
    text: "A week before, the day before, the morning of. You just show up.",
    tint: "bg-sky",
    visual: (
      <div className="flex w-full max-w-[300px] items-center gap-2.5 rounded-[20px] bg-glass px-3.5 py-3 font-system shadow-card">
        <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-peach text-[18px]">
          🎂
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-12 font-semibold tracking-[.04em] text-sub">REMEMBER ME · now</span>
          <span className="text-14 font-bold">Sara&apos;s birthday is tomorrow</span>
        </span>
      </div>
    ),
  },
] as const;

/** How it works (S3Rest): three steps joined by a dotted line on wide screens. */
export function HowItWorks() {
  return (
    <section
      id="how"
      aria-labelledby="how-heading"
      className="mx-auto flex max-w-[1200px] scroll-mt-20 flex-col gap-10 px-4 pt-[72px] pb-6 below-fold sm:px-8"
    >
      <div className="flex flex-col items-center gap-2.5 text-center">
        <Eyebrow className="self-center">easier than remembering it yourself</Eyebrow>
        <h2 id="how-heading" className="text-34 font-extrabold tracking-[-0.03em] sm:text-44">
          How it <Accent>works</Accent>
        </h2>
      </div>
      <div className="relative">
        <svg
          width="100%"
          height="40"
          viewBox="0 0 1136 40"
          preserveAspectRatio="none"
          aria-hidden
          className="pointer-events-none absolute top-[55px] left-0 hidden md:block"
        >
          <path
            d="M120 20 C 300 0, 420 40, 568 20 S 860 0, 1016 20"
            fill="none"
            stroke="var(--sub)"
            strokeWidth="2"
            strokeDasharray="2 9"
            strokeLinecap="round"
            opacity=".5"
          />
        </svg>
        <ol className="relative grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3.5">
              <div
                aria-hidden
                className={cn(
                  "flex h-[150px] items-center justify-center rounded-[28px] p-5",
                  step.tint,
                )}
              >
                {step.visual}
              </div>
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-text text-15 font-extrabold text-bg"
                >
                  {i + 1}
                </span>
                <h3 className="text-[21px] font-bold tracking-[-0.01em]">{step.title}</h3>
              </div>
              <p className="pl-12 text-16 leading-[1.55] text-sub">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const bubble =
  "max-w-[90%] rounded-[22px_22px_22px_6px] bg-card px-4 py-3 text-17 leading-[1.4] shadow-card";

/** Meet Noor (S3Rest): who she is, and an example chat where she reserves a gift. */
export function MeetNoor() {
  return (
    <section
      id="noor"
      aria-labelledby="noor-heading"
      className="mx-auto max-w-[1200px] scroll-mt-20 px-4 pt-12 pb-6 below-fold sm:px-8"
    >
      <div className="relative flex flex-wrap items-center gap-12 overflow-hidden rounded-[36px] bg-linear-160 from-rose to-card p-6 sm:p-14">
        <div
          aria-hidden
          className="absolute -top-[60px] -right-[60px] size-[260px] rounded-full bg-butter opacity-70"
        />
        <div className="relative flex min-w-0 flex-[1_1_340px] flex-col gap-3.5">
          <Eyebrow>meet your little helper</Eyebrow>
          <h2
            id="noor-heading"
            className="text-34 leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-44"
          >
            Say hi to <Accent className="text-rose-ink">Noor</Accent>
          </h2>
          <p className="max-w-[420px] text-[18px] leading-[1.6] text-sub">
            A tiny birthday candle who lives in the app. Noor means <i>light</i>, and keeping your
            people&apos;s days bright is her whole job.
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {[
              ["🔔", "gentle reminders"],
              ["🎁", "gift ideas"],
              ["🎉", "a little cheer"],
            ].map(([emoji, t]) => (
              <li key={t} className="rounded-pill bg-card px-3.5 py-2 text-14 font-semibold">
                <span aria-hidden>{emoji} </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <figure className="relative flex min-w-0 flex-[1_1_420px] items-end gap-4">
          <Noor size={110} mood="smiling" animated className="hidden shrink-0 sm:block" />
          <div className="flex min-w-0 flex-auto flex-col gap-2 font-system">
            <span className="pl-3 text-12 font-semibold text-sub">Noor</span>
            <p className={cn(bubble, "self-start")}>
              Hi! I&apos;m Noor 🕯️ Sara&apos;s birthday is in 3 days.
            </p>
            <p className={cn(bubble, "self-start")}>
              She saved an Instax on her wishlist. Want me to reserve it for you? 🤫
            </p>
            <p className="max-w-[90%] self-end rounded-[22px_22px_6px_22px] bg-[#0060df] px-4 py-3 text-17 leading-[1.4] text-[#ffffff]">
              yes please!!
            </p>
            <p className={cn(bubble, "self-start")}>Done. Your secret is safe with me ✨</p>
            <span
              role="img"
              aria-label="Noor is typing"
              className="flex gap-1 self-start rounded-[22px_22px_22px_6px] bg-card px-4 py-3.5 shadow-card"
            >
              {["0s", "0.15s", "0.3s"].map((d) => (
                <span
                  key={d}
                  style={{ "--dot-delay": d } as React.CSSProperties}
                  className="size-[7px] animate-dots rounded-full bg-sub opacity-60"
                />
              ))}
            </span>
            <figcaption className="sr-only">Example chat with Noor</figcaption>
          </div>
        </figure>
      </div>
    </section>
  );
}

/** FAQ (S3Rest): centred, one column, native <details> (first one open). */
export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="mx-auto flex max-w-[800px] scroll-mt-20 flex-col items-center gap-8 px-4 py-[72px] text-center below-fold sm:px-8"
    >
      <div className="flex flex-col items-center gap-2.5">
        <Eyebrow className="self-center">good questions</Eyebrow>
        <h2
          id="faq-heading"
          className="text-34 leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-44"
        >
          Questions, <Accent>answered</Accent>
        </h2>
      </div>
      <div className="flex flex-col gap-2.5 self-stretch text-left">
        {FAQ.map((f, i) => (
          <details
            key={f.question}
            open={i === 0}
            className="group rounded-[22px] bg-card px-6 py-5 shadow-card transition-[box-shadow] duration-200 hover:shadow-[var(--card-shadow-hover)] dark:bg-card2 dark:hover-tint dark:shadow-none"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-[12px] text-17 font-bold [&::-webkit-details-marker]:hidden">
              {f.question}
              <span
                aria-hidden
                className="grid size-[30px] shrink-0 place-items-center rounded-full bg-card transition-transform duration-300 ease-soft group-open:rotate-45"
              >
                <PlusIcon className="size-4" />
              </span>
            </summary>
            <p className="mt-3 pr-[46px] text-16 leading-[1.6] text-sub">{f.answer}</p>
          </details>
        ))}
      </div>
      <p className="text-16 text-sub">
        Still curious?{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-flex min-h-11 items-center font-semibold text-accent-text underline-offset-4 hover:underline"
        >
          Write to us
        </a>
      </p>
    </section>
  );
}

const CONFETTI = [
  "left-[6%] top-[18%] size-3.5 rounded-full bg-butter",
  "left-[12%] top-[70%] size-2.5 rotate-[20deg] rounded-[3px] bg-lilac-2",
  "left-[22%] top-[30%] size-2 rounded-full bg-mint-2",
  "left-[80%] top-[22%] size-3 -rotate-[15deg] rounded-[3px] bg-sky",
  "left-[90%] top-[62%] size-3.5 rounded-full bg-butter",
  "left-[72%] top-[80%] size-[9px] rotate-[35deg] rounded-[3px] bg-lilac-2",
  "left-[94%] top-[12%] size-2 rounded-full bg-rose-2",
  "left-[3%] top-[48%] size-[9px] rotate-[10deg] rounded-[3px] bg-sky",
];

/** Final CTA (S3Rest): "Someone's day is coming up". */
export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="mx-auto max-w-[1200px] px-4 pb-[72px] below-fold sm:px-8"
    >
      <div className="relative flex flex-col items-center gap-[18px] overflow-hidden rounded-[36px] bg-linear-160 from-peach to-peach-2 px-6 py-16 text-center text-peach-ink sm:px-8">
        {CONFETTI.map((c) => (
          <span key={c} aria-hidden className={cn("absolute opacity-90", c)} />
        ))}
        <Noor size={76} mood="smiling" />
        <h2
          id="cta-heading"
          className="relative text-[36px] leading-[1.08] font-extrabold tracking-[-0.03em] text-text sm:text-48"
        >
          Someone&apos;s day is <Accent className="text-peach-ink">coming up</Accent>
        </h2>
        <p className="relative text-[18px]">Start with one person. It takes a minute.</p>
        <Button asChild size="lg" className="relative px-7">
          <Link href="/sign-up">Start remembering</Link>
        </Button>
        <span className="relative -rotate-2 font-hand text-[19px]">{SIGN_UP_NOTE}</span>
      </div>
    </section>
  );
}
