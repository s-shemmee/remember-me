import { cn } from "@/lib/utils";

import { PlanDemo, ReminderStack } from "./demos";
import { SelectionFrame } from "./hero";

/** The handwritten eyebrow above a section heading. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("-rotate-2 self-start font-hand text-[21px] text-accent-text", className)}>
      {children}
    </span>
  );
}

/** A word or two in Instrument Serif italic. */
export function Accent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-serif font-normal italic", className)}>{children}</span>;
}

/** Every feature visual: 300px tall (no layout shift), with an "Example" caption. */
function Panel({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <figure
      className={cn(
        "relative flex h-[300px] min-w-0 flex-[1_1_400px] flex-col justify-center rounded-[32px] p-6 sm:p-8",
        className,
      )}
    >
      {children}
      <figcaption className="absolute top-3 right-5 text-12 font-semibold opacity-80">
        Example
      </figcaption>
    </figure>
  );
}

function Row({
  number,
  title,
  text,
  panel,
  reverse = false,
  id,
}: {
  number: string;
  title: React.ReactNode;
  text: string;
  panel: React.ReactNode;
  reverse?: boolean;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn("flex items-center gap-12", reverse ? "flex-wrap-reverse" : "flex-wrap")}
    >
      {reverse && panel}
      <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3.5">
        <span className="font-hand text-[19px] text-sub">{number}</span>
        <h3 className="text-[28px] leading-[1.15] font-extrabold tracking-[-0.025em] sm:text-34">
          {title}
        </h3>
        <p className="text-[18px] leading-[1.6] text-sub">{text}</p>
      </div>
      {!reverse && panel}
    </div>
  );
}

/** What's inside (S2Features): four zigzag rows. */
export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="mx-auto flex max-w-[1200px] scroll-mt-20 flex-col gap-16 px-4 py-[72px] below-fold sm:px-8"
    >
      <div className="flex max-w-[640px] flex-col gap-2.5">
        <Eyebrow>what&apos;s inside</Eyebrow>
        <h2
          id="features-heading"
          className="text-34 leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-44"
        >
          Everything you need to <Accent className="text-accent-text">show up</Accent> for them
        </h2>
      </div>

      <Row
        number="01"
        title={
          <>
            Reminders that feel like a{" "}
            <Accent className="text-peach-ink">friend&apos;s nudge</Accent>
          </>
        }
        text="A week before, the day before, the morning of. Noor tells you what's coming, and what they'd love, before it's too late."
        panel={
          <Panel className="bg-linear-160 from-peach to-peach-2 text-peach-ink">
            <ReminderStack />
          </Panel>
        }
      />

      <Row
        reverse
        number="02"
        title={
          <>
            Plan each birthday, <Accent className="text-lilac-ink">step by step</Accent>
          </>
        }
        text="A gift, a message, a call, the cake. Tap the steps: each one lights up as you go, and Noor cheers you on."
        panel={
          <Panel className="bg-linear-160 from-lilac to-lilac-2 text-lilac-ink">
            <PlanDemo />
          </Panel>
        }
      />

      <Row
        number="03"
        title={
          <>
            Wishlists with <Accent className="text-mint-ink">secret</Accent> reservations
          </>
        }
        text="Share what you'd love with the people you choose. Friends quietly reserve a gift, and you never find out who. Surprises stay surprises."
        panel={
          <Panel className="group flex-row items-center justify-center gap-5 bg-linear-160 from-mint to-mint-2 px-6 sm:px-10">
            <div className="relative flex-[0_1_190px] -rotate-3 transition-transform duration-300 ease-soft group-hover:-translate-x-2.5 group-hover:-translate-y-2.5 group-hover:-rotate-8">
              <div className="flex flex-col gap-1.5 rounded-[22px] bg-card p-4 shadow-card">
                <span aria-hidden className="text-[42px]">
                  📸
                </span>
                <span className="text-16 font-bold">Instax mini 12</span>
                <span className="text-13 text-sub">790 MAD</span>
              </div>
              <SelectionFrame label="reserved by you 🤫" />
            </div>
            <div className="flex flex-[0_1_190px] rotate-3 flex-col gap-1.5 rounded-[22px] bg-card p-4 shadow-card transition-transform duration-300 ease-soft group-hover:translate-x-2.5 group-hover:-translate-y-2.5 group-hover:rotate-8">
              <span aria-hidden className="text-[42px]">
                🌻
              </span>
              <span className="text-16 font-bold">Sunflower tote</span>
              <span className="text-13 text-sub">180 MAD · available</span>
            </div>
          </Panel>
        }
      />

      <Row
        reverse
        id="me"
        number="04"
        title={
          <>
            Your day matters <Accent className="text-rose-ink">too.</Accent>
          </>
        }
        text="Remember Me started with a forgotten birthday. Plan yours, keep a treat-yourself list, and write a note to future you, so you never wait on anyone to feel celebrated."
        panel={
          <Panel className="items-center bg-linear-160 from-rose to-rose-2 text-rose-ink">
            <div className="flex flex-col gap-1 rounded-[26px] bg-card px-[22px] py-5 text-text shadow-card">
              <span className="text-12 font-bold tracking-[.05em] text-rose-ink">CELEBRATE ME</span>
              <span className="text-[52px] leading-none font-extrabold tracking-[-0.04em]">
                12 days
              </span>
              <span className="text-14 text-sub">brunch ✓ · cake ✓ · call grandma</span>
            </div>
            <span className="absolute right-6 bottom-5 rotate-4 rounded-[6px] bg-butter px-3.5 py-2.5 font-hand text-[18px] text-butter-ink">
              you made it another year 🤍
            </span>
          </Panel>
        }
      />
    </section>
  );
}
