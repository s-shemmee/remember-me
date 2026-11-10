/**
 * What Noor says on each step (copy from the approved AppOnboard screen).
 * First person, warm, one emoji max. Shown in an aria-live="polite" bubble,
 * so these change only on step changes and on blur of the person's name.
 * What's missing is said by the action bar, not by Noor.
 */
export function noorLine(
  step: number,
  ctx: { firstName: string; birthdayDone: boolean; personName: string },
): string {
  const name = ctx.firstName.trim();
  const person = ctx.personName.trim();
  switch (step) {
    case 0:
      return `Hi${name ? ` ${name}` : ""}! I'm Noor 🕯️ I'll help you remember the people you love. But first, you.`;
    case 1:
      return ctx.birthdayDone
        ? "Nice! I love that. Now let's make you look like you 🎨"
        : "Let's make you look like you 🎨";
    case 2:
      return person
        ? `Ooh, ${person}! Tell me a little thing they love, and I'll use it for gift ideas 💡`
        : "Now the fun part. Who should never be forgotten? 💌";
    case 3:
      return "Last thing. When should I nudge you? I picked my favourites 🔔";
    default:
      return person
        ? `Done! I'll remind you before ${person}'s day. You just show up 🥹`
        : "Done! Add your people anytime from Home 🥹";
  }
}

/**
 * The action bar's message when Continue needs something (the one message
 * screen readers hear; the field shows its own error too). Missing
 * birthdays get the screen's summary line; anything else uses the field's
 * message.
 */
export function needsMessage(step: number, errors: Record<string, string>): string {
  const missingBirthday = /day and month/.test(errors.day ?? errors.month ?? "");
  if (step === 0 && missingBirthday && !errors.firstName) {
    return "Pick your birthday day and month to continue.";
  }
  if (step === 2 && (errors.name || missingBirthday)) {
    return "Add their name and birthday, or skip for now.";
  }
  return Object.values(errors)[0] ?? "Something's missing. Check the fields above.";
}

const SOON: Record<number, string> = {
  14: "is in 2 weeks",
  7: "is in 7 days",
  3: "is in 3 days",
  1: "is tomorrow",
  0: "is today",
};

/**
 * The sample notification on the reminders step: the first person's name
 * when there is one ("Sara's birthday is in 7 days"), else a generic one.
 * Uses the earliest reminder picked.
 */
export function sampleNudge(personName: string | null, offsets: readonly number[]): string {
  const first = offsets.length ? Math.max(...offsets) : 7;
  const who = personName?.trim() ? `${personName.trim()}'s` : "A friend's";
  return `${who} birthday ${SOON[first] ?? SOON[7]}`;
}
