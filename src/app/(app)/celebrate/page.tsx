import { GiftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { daysToGoLabel, noorCountdownLine, turningLine } from "@/features/celebrate/countdown";
import { FutureNoteCard } from "@/features/celebrate/components/future-note";
import { CelebrateNoor, MyPlanCard } from "@/features/celebrate/components/my-plan";
import { OwnDayReminders } from "@/features/celebrate/components/own-day-reminders";
import { ShareWishlistButton } from "@/features/celebrate/components/share-wishlist";
import { loadCelebrate } from "@/features/celebrate/load";
import { PlansProvider } from "@/features/plans/components/plan-state";
import { planKey, type PlanTarget } from "@/features/plans/steps";
import { AppMain } from "@/features/shell/app-shell";
import {
  HeaderLabel,
  headerPrimaryClass,
  PageHeader,
  PageHeaderFallback,
} from "@/features/shell/page-header";
import { notificationsInboxEnabled } from "@/lib/flags";
import type { Wish } from "@/features/wishes/load";
import { formatPrice } from "@/features/wishes/schema";
import { formatShortDate, toIsoDate } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Celebrate Me · Remember Me" };

function WishRow({ wish }: { wish: Wish }) {
  const price = formatPrice(wish.price, wish.currency);
  return (
    <li className="flex min-w-0 flex-col rounded-[18px] bg-card px-3.5 py-3">
      <span className="text-15 font-bold [overflow-wrap:anywhere]">{wish.title}</span>
      {price && <span className="text-13 text-sub">{price}</span>}
    </li>
  );
}

async function Celebrate() {
  const supabase = await createSupabaseServerClient();
  const data = await loadCelebrate(supabase);
  const c = data.countdown;
  const target: PlanTarget | null = c
    ? {
        key: planKey(null, c.occursOn),
        occasionId: null,
        occursOn: c.occursOn,
        heading: "My plan",
        date: formatShortDate(c.on),
        name: data.firstName || "You",
        color: "rose",
        style: "own",
      }
    : null;
  const today = toIsoDate(data.today);
  const birthday = data.birthdayList?.wishes ?? [];
  const treats = data.treatList?.wishes ?? [];

  return (
    <PlansProvider plans={data.plans}>
      <PageHeader
        title={
          <>
            Celebrate <span className="font-serif font-normal text-accent-text italic">Me</span>
          </>
        }
        subtitle="Your day matters too. Plan it, treat yourself, keep the memories."
        primary={
          <Button asChild className={headerPrimaryClass}>
            <Link href="/wishlists?list=birthday">
              <GiftIcon aria-hidden /> <HeaderLabel>My wishlist</HeaderLabel>
            </Link>
          </Button>
        }
        bell={notificationsInboxEnabled()}
      />

      <section
        aria-label="Countdown"
        className="relative flex flex-wrap items-center gap-6 overflow-hidden rounded-[32px] bg-linear-150 from-rose to-lilac px-6 py-7 text-rose-ink sm:gap-8 sm:px-9 sm:py-8"
      >
        {c ? (
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1.5">
            <span className="text-13 font-bold tracking-[.06em] uppercase">
              Your birthday · {c.dateLabel}
            </span>
            {c.daysUntil === 0 ? (
              <span className="font-serif text-[56px] leading-none text-text italic sm:text-[72px]">
                It&apos;s your day
              </span>
            ) : (
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-[72px] leading-[.95] font-extrabold tracking-[-0.05em] text-text sm:text-[96px]">
                  {c.daysUntil}
                </span>
                <span className="font-serif text-[32px] text-text italic sm:text-[40px]">
                  {daysToGoLabel(c.daysUntil)}
                </span>
              </span>
            )}
            <span className="mt-1.5 self-start font-hand text-[19px] motion-reduce:rotate-0 sm:-rotate-[1.5deg] sm:text-[22px]">
              {turningLine(c.turning, c.stage)}
            </span>
          </div>
        ) : (
          <div className="flex min-w-0 flex-[1_1_300px] flex-col items-start gap-3">
            <span className="text-13 font-bold tracking-[.06em]">YOUR BIRTHDAY</span>
            <p className="text-22 font-extrabold text-text">
              Add your birthday, and I&apos;ll count down with you.
            </p>
            <Button asChild variant="card2" className="bg-card">
              <Link href="/profile">Add it in my profile</Link>
            </Button>
          </div>
        )}
        <CelebrateNoor
          stageLine={
            c
              ? noorCountdownLine(c, data.firstName)
              : "Your day deserves a plan too. Tell me when it is ✨"
          }
          target={target}
          noteOpensToday={data.openedNote?.opensOn === today}
        />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {target ? (
          <MyPlanCard target={target} />
        ) : (
          <section
            aria-labelledby="my-plan"
            className="flex flex-col gap-3 rounded-[28px] bg-card p-[22px] shadow-card"
          >
            <h2 id="my-plan" className="text-[18px] font-extrabold">
              My plan
            </h2>
            <p className="text-14 text-sub">Add your birthday first, then plan it here.</p>
          </section>
        )}

        <div className="flex min-w-0 flex-col gap-5">
          <section
            aria-labelledby="my-birthday-list"
            className="flex flex-col gap-3 rounded-[28px] bg-card2 p-[22px]"
          >
            <div className="flex flex-col gap-0.5">
              <h2 id="my-birthday-list" className="text-[18px] font-extrabold">
                My birthday wishlist
              </h2>
              <p className="text-13 text-sub">
                {birthday.length
                  ? `${birthday.length} ${birthday.length === 1 ? "wish" : "wishes"} · your connections can see it`
                  : "Nothing on it yet. Your connections can see it."}
              </p>
            </div>
            {birthday.length > 0 && (
              <ul aria-labelledby="my-birthday-list" className="flex flex-col gap-2">
                {birthday.slice(0, 3).map((w) => (
                  <WishRow key={w.id} wish={w} />
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-start gap-2">
              <Button asChild variant="card2" className="bg-card">
                <Link href="/wishlists?list=birthday&add=1">Add a wish</Link>
              </Button>
              <ShareWishlistButton />
            </div>
          </section>

          <section
            aria-labelledby="treat"
            className="flex flex-col gap-3 rounded-[28px] bg-linear-160 from-butter to-card p-[22px]"
          >
            <h2 id="treat" className="text-[18px] font-extrabold">
              Treat yourself
            </h2>
            <p className="text-14 text-sub">
              {treats.length
                ? "No waiting for anyone. Pick one this month."
                : "Little things just for you. Only you can see this list."}
            </p>
            {treats.length > 0 && (
              <ul aria-labelledby="treat" className="flex flex-col gap-2">
                {treats.slice(0, 3).map((w) => (
                  <WishRow key={w.id} wish={w} />
                ))}
              </ul>
            )}
            <Link
              href="/wishlists?list=treat"
              className="inline-flex min-h-11 items-center self-start text-14 font-semibold text-accent-text underline-offset-4 hover:underline"
            >
              Open my treat list
            </Link>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2 xl:col-span-1">
          <FutureNoteCard
            hasBirthday={Boolean(c)}
            sealed={data.sealedNote}
            opened={data.openedNote}
            today={today}
          />
          <OwnDayReminders initial={data.remindMyDay} />
        </div>
      </div>

      <section aria-labelledby="memories" className="flex flex-col gap-3.5">
        <h2 id="memories" className="text-22 font-extrabold tracking-[-0.02em]">
          Birthday <span className="font-serif font-normal text-accent-text italic">memories</span>
        </h2>
        <div className="flex flex-wrap items-center gap-3 rounded-[24px] border-2 border-dashed border-line p-6">
          <span className="flex-1 text-15 text-sub">
            A photo, a message, a feeling from each birthday. Coming soon.
          </span>
          <span className="shrink-0 rounded-pill bg-card2 px-3 py-1.5 text-13 font-bold">
            Coming soon
          </span>
        </div>
      </section>
    </PlansProvider>
  );
}

export default function CelebratePage() {
  return (
    <AppMain>
      <Suspense
        fallback={
          <>
            <PageHeaderFallback title="Celebrate Me" />
            <Card aria-busy="true" className="h-64" />
          </>
        }
      >
        <Celebrate />
      </Suspense>
    </AppMain>
  );
}
