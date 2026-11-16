/**
 * "Download my data": everything that's yours, as JSON. Pure (tested).
 *
 * Included: profile, reminder settings, devices (labels and dates, never
 * keys), people and their days, your wishlists and wishes, and the gifts
 * YOU reserved (friend's first name, wish title, date). Never reservations
 * on your own wishes (the database never shows them to you anyway), never
 * other people's private data.
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
    gifts_you_reserved: input.reserved.map((r) => ({
      for: r.friendFirstName,
      wish: r.wishTitle,
      reserved_on: r.reservedAt,
    })),
  };
}

export const exportFileName = (isoDate: string) => `remember-me-data-${isoDate.slice(0, 10)}.json`;
