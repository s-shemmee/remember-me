/**
 * "Download my data": everything that's yours, as JSON. Pure (tested).
 *
 * Included: profile, reminder settings, devices (labels and dates, never
 * keys), people and their days, your wishlists and wishes, the gifts YOU
 * reserved (friend's first name, wish title, date), your plans (including
 * retained legacy message text), retained gift-suggestion results, and your
 * notes to future you (a sealed one only says when it opens: its words stay
 * sealed until then). Never reservations on your own wishes (the database
 * never shows them to you anyway), never other people's private data.
 */

export type ExportInput = {
  exportedAt: string;
  email: string | null;
  profile: Record<string, unknown> | null;
  reminderSettings: Record<string, unknown> | null;
  devices: { device_label: string; created_at: string; last_used_at: string | null }[];
  people: (Record<string, unknown> & { occasions?: Record<string, unknown>[] })[];
  wishlists: { id: string; title: string; kind: string; visibility: string }[];
  wishes: (Record<string, unknown> & { wishlist_id: string })[];
  /** Your reservations, with what friend_wishes() and my_friends() show you. */
  reserved: { friendFirstName: string; wishTitle: string; reservedAt: string }[];
  /** Your plans: whose day ("Khalid", or null for yours), the date, steps and note. */
  plans?: {
    for: string | null;
    occursOn: string;
    note: string | null;
    steps: { label: string; done: boolean; message?: string }[];
  }[];
  /** Existing results from the retired feature, included for data portability. */
  giftIdeas?: {
    for: string | null;
    occasionKind: string;
    budget: string | null;
    madeAt: string;
    ideas: unknown;
  }[];
  /** Notes you can read (from their day on). */
  openedNotes?: { opensOn: string; body: string; writtenAt: string }[];
  /** A note still sealed: when it opens, never its words. */
  sealedNote?: { opensOn: string; writtenAt: string } | null;
  /** Your connections: their first name only, and which of your people they are. */
  connections?: { firstName: string; connectedAt: string; yourPerson: string | null }[];
};

export function buildExport(input: ExportInput) {
  return {
    format: "remember-me-export",
    version: 1,
    exported_at: input.exportedAt,
    account: { email: input.email },
    profile: input.profile,
    reminder_settings: input.reminderSettings,
    notification_devices: input.devices.map((d) => ({
      label: d.device_label,
      added: d.created_at,
      last_used: d.last_used_at,
    })),
    people: input.people.map(({ occasions, ...person }) => ({
      ...person,
      days: occasions ?? [],
    })),
    wishlists: input.wishlists.map((list) => ({
      title: list.title,
      kind: list.kind,
      shared_with: list.visibility === "connections" ? "your connections" : "only you",
      wishes: input.wishes
        .filter((w) => w.wishlist_id === list.id)
        .map(({ wishlist_id: _list, ...wish }) => wish),
    })),
    connections: (input.connections ?? []).map((c) => ({
      first_name: c.firstName,
      connected_on: c.connectedAt,
      in_your_people_as: c.yourPerson,
    })),
    gifts_you_reserved: input.reserved.map((r) => ({
      for: r.friendFirstName,
      wish: r.wishTitle,
      reserved_on: r.reservedAt,
    })),
    plans: (input.plans ?? []).map((p) => ({
      for: p.for ?? "your own birthday",
      date: p.occursOn,
      note: p.note,
      steps: p.steps,
    })),
    gift_ideas: (input.giftIdeas ?? []).map((g) => ({
      for: g.for,
      occasion_kind: g.occasionKind,
      budget: g.budget,
      made_on: g.madeAt,
      ideas: g.ideas,
    })),
    notes_to_future_you: [
      ...(input.openedNotes ?? []).map((n) => ({
        opens_on: n.opensOn,
        written_on: n.writtenAt,
        note: n.body,
      })),
      ...(input.sealedNote
        ? [
            {
              opens_on: input.sealedNote.opensOn,
              written_on: input.sealedNote.writtenAt,
              note: "Sealed until your birthday.",
            },
          ]
        : []),
    ],
  };
}

export const exportFileName = (isoDate: string) => `remember-me-data-${isoDate.slice(0, 10)}.json`;
