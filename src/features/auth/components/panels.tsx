import { Avatar } from "@/components/ui/avatar";
import { Noor } from "@/components/ui/noor";
import { cn } from "@/lib/utils";

import { LiveDate } from "./live-date";

// Decorative example panels for the auth pages (aria-hidden in AuthShell).
// Sample content only, never real data.
//
// Motion (exception for these panels only): items fade up
// once at 0.2s / 0.7s / 1.2s / 1.7s, one card per panel floats 3 times (about
// 15s) and rests, Noor bobs. All of it stops under reduced motion.

const enter = {
  first: "animate-panel-in [--in-delay:200ms]",
  second: "animate-panel-in [--in-delay:700ms]",
  third: "animate-panel-in [--in-delay:1200ms]",
  fourth: "animate-panel-in [--in-delay:1700ms]",
} as const;

function Bubble({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "max-w-[320px] self-start rounded-[22px_22px_22px_6px] bg-card px-4 py-3 font-system text-17 leading-[1.4] shadow-card",
        className,
      )}
    >
      {children}
    </span>
  );
}

function NoorSays({ lines }: { lines: [string, string] }) {
  return (
    <div className="absolute right-[10%] bottom-[10%] left-[12%] flex items-end gap-3.5">
      <Noor size={120} mood="smiling" animated />
      <div className="flex flex-col gap-2">
        <Bubble className={enter.third}>{lines[0]}</Bubble>
        <Bubble className={enter.fourth}>{lines[1]}</Bubble>
      </div>
    </div>
  );
}

export const signUpPanelClass = "bg-[linear-gradient(160deg,var(--lilac),var(--rose))]";

export function SignUpPanel() {
  return (
    <>
      <div
        className={cn(
          "absolute top-[9%] left-[12%] flex w-[340px] -rotate-2 gap-3 rounded-[22px] bg-glass px-4 py-3.5 font-system shadow-card backdrop-blur-xl",
          enter.first,
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-chip bg-peach text-22">
          🎂
        </span>
        <span className="flex grow flex-col gap-0.5">
          <span className="flex justify-between text-12 font-semibold tracking-[.04em] text-sub">
            <span>REMEMBER ME</span>
            <span>now</span>
          </span>
          <span className="text-15 font-bold">Sara&apos;s birthday is tomorrow</span>
        </span>
      </div>

      <div
        data-motion="float"
        className="absolute top-[24%] right-[10%] flex rotate-3 animate-panel-in-float flex-col gap-0.5 rounded-card bg-card px-[18px] py-4 shadow-card [--in-delay:700ms]"
      >
        <span className="text-12 font-bold tracking-[.05em] text-rose-ink">CELEBRATE ME</span>
        <span className="text-34 font-extrabold tracking-heading">12 days</span>
      </div>

      {/* Kalam at ~0.8 of the 26px the design sizes for Caveat. */}
      <p
        className={cn(
          "absolute top-[34%] left-[14%] -rotate-4 font-hand text-[1.3rem] text-lilac-ink",
          enter.second,
        )}
      >
        free, forever ✨
      </p>

      <NoorSays
        lines={[
          "hi! I'm Noor 👋",
          "Once you're in, we'll add your first person together. Who's the first name that comes to mind? 🤍",
        ]}
      />
    </>
  );
}

export const logInPanelClass = "bg-[linear-gradient(160deg,var(--peach),var(--butter))]";

const sampleMonth = [
  { name: "Khalid", pastel: "butter", when: "in 6 days" },
  { name: "Mom & Dad", pastel: "sky", when: "in 13 days" },
  { name: "Yasmine", pastel: "mint", when: "in 21 days" },
] as const;

export function LogInPanel() {
  return (
    <>
      <div
        data-motion="float"
        className="absolute top-[9%] left-[12%] flex size-[170px] -rotate-3 animate-panel-in-float flex-col items-center justify-center rounded-[30px] bg-card shadow-card [--in-delay:200ms]"
      >
        <LiveDate />
      </div>

      <div
        className={cn(
          "absolute top-[13%] right-[9%] flex w-[270px] rotate-2 flex-col gap-2.5 rounded-[26px] bg-card p-[18px] shadow-card",
          enter.second,
        )}
      >
        <span className="text-12 font-bold tracking-[.05em] text-sub">A MONTH IN REMEMBER ME</span>
        {sampleMonth.map((p) => (
          <span key={p.name} className="flex items-center gap-2.5 text-15 font-semibold">
            <Avatar
              name={p.name}
              pastel={p.pastel}
              size="sm"
              decorative
              className="size-8 text-12"
            />
            {p.name}
            <span className="ml-auto font-medium text-sub">{p.when}</span>
          </span>
        ))}
      </div>

      <NoorSays
        lines={["welcome back! 🥹", "log in and I'll tell you whose day is coming up 🎂"]}
      />
    </>
  );
}
