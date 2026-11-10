"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useSyncExternalStore, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Noor } from "@/components/ui/noor";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

import { completeOnboarding } from "../actions";
import { STEP_COUNT } from "../constants";
import { needsMessage, noorLine } from "../noor-lines";
import { fieldErrors, stepSchemas } from "../schema";
import { clearOnboardingDraft, useOnboardingDraft } from "../store";
import {
  NotificationPreview,
  PersonPreview,
  StepDone,
  StepLook,
  StepPerson,
  StepReminders,
  StepYou,
  YouPreview,
} from "./steps";

/** Panel tint per step, as in the screen: rose, lilac, peach, sky, mint. */
const TINTS = [
  "bg-[linear-gradient(160deg,var(--rose),var(--card))]",
  "bg-[linear-gradient(160deg,var(--lilac),var(--card))]",
  "bg-[linear-gradient(160deg,var(--peach),var(--card))]",
  "bg-[linear-gradient(160deg,var(--sky),var(--card))]",
  "bg-[linear-gradient(160deg,var(--mint),var(--card))]",
];

/** Where focus goes for the first error of each field. */
const FIELD_IDS: Record<string, string> = {
  firstName: "you-first-name",
  character: "look-character-first",
  name: "person-name",
  littleThing: "person-little-thing",
  offsets: "reminder-first",
};
const fieldId = (step: number, field: string) => {
  const prefix = step === 0 ? "you-bday" : "person-bday";
  if (field === "day" || field === "month" || field === "year") return `${prefix}-${field}`;
  return FIELD_IDS[field];
};

const subscribeHydration = (cb: () => void) => useOnboardingDraft.persist.onFinishHydration(cb);
const useDraftHydrated = () =>
  useSyncExternalStore(
    subscribeHydration,
    () => useOnboardingDraft.persist.hasHydrated(),
    () => false,
  );

export function OnboardingFlow({
  userId,
  initialFirstName,
}: {
  userId: string;
  initialFirstName: string;
}) {
  const hydrated = useDraftHydrated();
  const draft = useOnboardingDraft();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  // What Continue needs, shown in the action bar: the one message announced.
  const [needs, setNeeds] = React.useState("");
  // The person's name as Noor knows it: updated on blur, not per keystroke.
  const [committedName, setCommittedPersonName] = React.useState<string | null>(null);
  const [doneName, setDoneName] = React.useState<string | null | undefined>(undefined);
  // Kept for "You're all set, Sara": the draft is cleared once saved.
  const [doneFirstName, setDoneFirstName] = React.useState("");
  const [pending, startTransition] = useTransition();
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Start or resume this user's draft once sessionStorage is loaded.
  React.useEffect(() => {
    if (hydrated) {
      useOnboardingDraft.getState().begin(userId, initialFirstName);
    }
  }, [hydrated, userId, initialFirstName]);

  const done = doneName !== undefined;
  const step = done ? STEP_COUNT : draft.step;

  // New step: move focus to its heading so screen readers start there.
  const prevStep = React.useRef(step);
  React.useEffect(() => {
    if (prevStep.current !== step) {
      contentRef.current?.querySelector<HTMLElement>("h1")?.focus();
      prevStep.current = step;
    }
  }, [step]);

  if (!hydrated) {
    return <div aria-busy="true" className="min-h-dvh" />;
  }

  const goTo = (next: number) => {
    setErrors({});
    setNeeds("");
    draft.setStep(next);
  };

  const showErrors = (stepIndex: number, errs: Record<string, string>, message: string) => {
    setErrors(errs);
    setNeeds(message);
    if (stepIndex !== draft.step) draft.setStep(stepIndex);
    const first = Object.keys(errs)[0];
    const id = first ? fieldId(stepIndex, first) : undefined;
    requestAnimationFrame(() => document.getElementById(id ?? "")?.focus());
  };

  const stepValue = (s: number): unknown =>
    s === 0
      ? draft.you
      : s === 1
        ? draft.look
        : s === 2
          ? { ...draft.person, skipped: false }
          : draft.reminders;

  const submit = () => {
    startTransition(async () => {
      const result = await completeOnboarding({
        you: draft.you,
        look: draft.look,
        person: draft.person.skipped ? { skipped: true } : { ...draft.person, skipped: false },
        reminders: draft.reminders,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      });
      if (result.ok) {
        setDoneFirstName(draft.you.firstName);
        clearOnboardingDraft();
        setDoneName(result.personName);
      } else {
        showErrors(result.step, result.fieldErrors ?? {}, result.message);
      }
    });
  };

  const onContinue = () => {
    const parsed = stepSchemas[step as 0 | 1 | 2 | 3].safeParse(stepValue(step));
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      showErrors(step, errs, needsMessage(step, errs));
      return;
    }
    if (step === 2) draft.setPerson({ skipped: false });
    if (step === 3) submit();
    else goTo(step + 1);
  };

  const onSkip = () => {
    if (step === 2) draft.setPerson({ skipped: true });
    goTo(step + 1);
  };

  const line = noorLine(step, {
    firstName: draft.you.firstName,
    birthdayDone: draft.you.day !== null && draft.you.month !== null,
    personName: done ? (doneName ?? "") : (committedName ?? draft.person.name),
  });

  // Desktop only: what this step will look like, at the top of Noor's column.
  const preview =
    step === 1 ? (
      <YouPreview look={draft.look} firstName={draft.you.firstName} />
    ) : step === 2 ? (
      <PersonPreview person={draft.person} className="-rotate-[1.5deg]" />
    ) : step === 3 ? (
      <NotificationPreview
        personName={draft.person.skipped ? null : draft.person.name}
        offsets={draft.reminders.offsets}
      />
    ) : null;

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="mx-auto flex w-full max-w-[1180px] items-center gap-4 px-4 py-5 sm:px-8 lg:gap-5">
        <Logo href={null} label="Remember me" />
        <Progress step={step} />
        <ThemeToggle />
      </header>

      {/* Below 1024px: Noor's strip on top, the step below. From 1024px: two
          columns of the same height, previews on top of Noor's column. */}
      <div className="mx-auto grid w-full max-w-[1180px] flex-1 content-start gap-6 px-4 pb-10 sm:px-8 lg:grid-cols-[400px_minmax(0,1fr)] lg:content-stretch lg:gap-12">
        <aside
          className={cn(
            "flex flex-col gap-[18px] rounded-panel-lg p-4 transition-[background] duration-500 ease-soft sm:p-8 lg:min-h-[600px] lg:justify-between lg:p-7",
            TINTS[step],
          )}
        >
          {preview && <div className="hidden flex-col gap-3.5 lg:flex">{preview}</div>}
          <div className="flex items-end gap-3.5 lg:mt-auto lg:gap-3">
            <Noor size={58} mood="smiling" animated className="shrink-0 lg:hidden" />
            <Noor size={96} mood="smiling" animated className="hidden shrink-0 lg:block" />
            <p
              aria-live="polite"
              className="max-w-[320px] min-w-0 self-end rounded-[22px_22px_22px_6px] bg-card px-4 py-3 font-system text-15 leading-[1.4] [overflow-wrap:anywhere] shadow-card sm:text-17 lg:text-16"
            >
              {line}
            </p>
          </div>
        </aside>

        <main id="main" className="flex min-w-0 flex-col lg:min-h-[600px] lg:pt-2">
          {step > 0 && !done && (
            <Button
              variant="transparent"
              onClick={() => goTo(step - 1)}
              disabled={pending}
              className="-ml-3 self-start px-3 text-sub hover:text-text"
            >
              <ArrowLeftIcon aria-hidden /> Back
            </Button>
          )}

          <div
            key={step}
            ref={contentRef}
            className="flex w-full flex-1 animate-panel-in flex-col gap-[22px] [--in-delay:0ms]"
          >
            {step === 0 && (
              <StepYou
                value={draft.you}
                onChange={(patch) => {
                  draft.setYou(patch);
                  if (Object.keys(errors).length) setErrors({});
                }}
                errors={errors}
              />
            )}
            {step === 1 && (
              <StepLook
                value={draft.look}
                firstName={draft.you.firstName}
                onChange={draft.setLook}
                errors={errors}
              />
            )}
            {step === 2 && (
              <StepPerson
                value={draft.person}
                onChange={draft.setPerson}
                onNameCommit={setCommittedPersonName}
                errors={errors}
              />
            )}
            {step === 3 && (
              <StepReminders
                value={draft.reminders}
                onChange={draft.setReminders}
                errors={errors}
              />
            )}
            {done && <StepDone firstName={doneFirstName} personName={doneName ?? null} />}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-2.5 border-t border-line pt-5">
            <p
              id="onboarding-needs"
              aria-live="polite"
              className="min-w-[min(100%,14rem)] flex-1 text-13 font-semibold text-accent-text"
            >
              {needs}
            </p>
            {done ? (
              <Button asChild size="lg">
                <Link href="/home">Take me home</Link>
              </Button>
            ) : (
              <>
                {(step === 1 || step === 2) && (
                  <Button
                    variant="transparent"
                    onClick={onSkip}
                    disabled={pending}
                    className="text-sub hover:text-text"
                  >
                    Skip for now
                  </Button>
                )}
                <Button size="lg" onClick={onContinue} aria-disabled={pending || undefined}>
                  {step === 3 ? (pending ? "Saving…" : "Finish") : "Continue"}
                  {step < 3 && <ArrowRightIcon aria-hidden />}
                </Button>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  const label = step >= STEP_COUNT ? "All done" : `Step ${step + 1} of ${STEP_COUNT}`;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 lg:flex-row lg:gap-5">
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={STEP_COUNT}
        aria-valuenow={Math.min(step, STEP_COUNT)}
        aria-valuetext={label}
        className="mx-auto flex w-full max-w-[420px] gap-1.5"
      >
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 flex-1 rounded-pill transition-colors duration-300 ease-soft",
              i < step || step >= STEP_COUNT
                ? "bg-accent"
                : i === step
                  ? "bg-[color-mix(in_srgb,var(--accent)_45%,transparent)]"
                  : "bg-line",
            )}
          />
        ))}
      </div>
      <span aria-hidden className="text-13 font-semibold whitespace-nowrap text-sub lg:text-14">
        {label}
      </span>
    </div>
  );
}
