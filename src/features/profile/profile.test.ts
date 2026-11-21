import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { reauthModeFor } = await import("@/features/account/reauth");
const { buildExport, exportFileName } = await import("@/features/account/export");
const { squareCrop } = await import("./avatar-image");
const { aboutSchema, isTimeZone, lookSchema, signedInRecently, REAUTH_WINDOW_SECONDS } =
  await import("./schema");

const valid = {
  firstName: "Maya",
  lastName: "",
  birthday: { day: 22, month: 11, year: null },
  city: "",
  bio: "",
  timezone: "Africa/Casablanca",
};
const look = { kind: "initials", color: "lilac", character: null, photoPath: null };

describe("About you", () => {
  it("accepts a normal profile; empty last name, city and little line are null", () => {
    const r = aboutSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ lastName: null, city: null, bio: null });
    expect(
      aboutSchema.parse({ ...valid, lastName: " Alaoui ", city: "Rabat", bio: "Tea first." }),
    ).toMatchObject({ lastName: "Alaoui", city: "Rabat", bio: "Tea first." });
  });

  it("first name: needed, up to 40 characters", () => {
    expect(aboutSchema.safeParse({ ...valid, firstName: "  " }).success).toBe(false);
    expect(aboutSchema.safeParse({ ...valid, firstName: "x".repeat(41) }).success).toBe(false);
    expect(aboutSchema.safeParse({ ...valid, firstName: "x".repeat(40) }).success).toBe(true);
  });

  it("last name 40, city 80, little line 120 characters at most", () => {
    expect(aboutSchema.safeParse({ ...valid, lastName: "x".repeat(41) }).success).toBe(false);
    expect(aboutSchema.safeParse({ ...valid, city: "x".repeat(81) }).success).toBe(false);
    expect(aboutSchema.safeParse({ ...valid, bio: "x".repeat(121) }).success).toBe(false);
    expect(aboutSchema.safeParse({ ...valid, bio: "x".repeat(120) }).success).toBe(true);
  });

  it("birthday: a real date; 29 February only with a leap year (or no year)", () => {
    const bday = (day: number, month: number, year: number | null) =>
      aboutSchema.safeParse({ ...valid, birthday: { day, month, year } }).success;
    expect(bday(31, 4, null)).toBe(false);
    expect(bday(29, 2, null)).toBe(true);
    expect(bday(29, 2, 2000)).toBe(true);
    expect(bday(29, 2, 2001)).toBe(false);
    expect(bday(1, 1, new Date().getFullYear() + 1)).toBe(false);
  });

  it("look: a photo needs a photo, a character needs a character", () => {
    expect(lookSchema.safeParse(look).success).toBe(true);
    expect(lookSchema.safeParse({ ...look, kind: "photo" }).success).toBe(false);
    expect(lookSchema.safeParse({ ...look, kind: "character" }).success).toBe(false);
    expect(lookSchema.safeParse({ ...look, kind: "character", character: "fox" }).success).toBe(
      true,
    );
  });

  it("time zone: one this runtime knows", () => {
    expect(isTimeZone("Europe/London")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("../../etc")).toBe(false);
    expect(aboutSchema.safeParse({ ...valid, timezone: "Nope/Nowhere" }).success).toBe(false);
  });

  it("photos are cropped to the centred square", () => {
    expect(squareCrop(1200, 800)).toEqual({ sx: 200, sy: 0, side: 800 });
    expect(squareCrop(600, 900)).toEqual({ sx: 0, sy: 150, side: 600 });
  });
});

describe("re-authentication", () => {
  it("email accounts use the password; Google-only accounts a recent sign-in", () => {
    expect(reauthModeFor(["email"])).toBe("password");
    expect(reauthModeFor(["google", "email"])).toBe("password");
    expect(reauthModeFor(["google"])).toBe("recent-sign-in");
  });

  it("a sign-in within the last 10 minutes counts, older doesn't", () => {
    const now = 1_800_000_000;
    expect(REAUTH_WINDOW_SECONDS).toBe(600);
    expect(signedInRecently([{ method: "oauth", timestamp: now - 599 }], now)).toBe(true);
    expect(signedInRecently([{ method: "oauth", timestamp: now - 601 }], now)).toBe(false);
    expect(
      signedInRecently(
        [
          { method: "oauth", timestamp: now - 5000 },
          { method: "oauth", timestamp: now - 60 },
        ],
        now,
      ),
    ).toBe(true);
    expect(signedInRecently(undefined, now)).toBe(false);
    expect(signedInRecently([{ method: "oauth" }], now)).toBe(false);
  });
});

describe("Download my data", () => {
  const data = buildExport({
    exportedAt: "2026-11-16T10:00:00.000Z",
    email: "c@example.com",
    profile: { first_name: "Maya", birth_year: 1994 },
    reminderSettings: { offsets_days: [7, 1, 0] },
    devices: [{ device_label: "Chrome on Android", created_at: "2026-11-14", last_used_at: null }],
    people: [{ name: "Khalid", occasions: [{ kind: "birthday", day: 13, month: 11 }] }],
    wishlists: [
      { id: "l1", title: "My birthday", kind: "birthday", visibility: "connections" },
      { id: "l2", title: "Treat yourself", kind: "treat", visibility: "private" },
    ],
    wishes: [
      { wishlist_id: "l1", title: "Olive tree" },
      { wishlist_id: "l2", title: "Concert ticket" },
    ],
    reserved: [{ friendFirstName: "Sara", wishTitle: "Instax", reservedAt: "2026-11-10" }],
    plans: [
      {
        for: "Khalid",
        occursOn: "2026-11-13",
        note: "Rooftop",
        steps: [{ label: "Gift", done: true }],
      },
      { for: null, occursOn: "2026-11-22", note: null, steps: [] },
    ],
    openedNotes: [{ opensOn: "2025-11-22", body: "Dear me", writtenAt: "2025-01-02" }],
    sealedNote: { opensOn: "2026-11-22", writtenAt: "2026-01-02" },
  });

  it("has my plans, and my notes: a sealed one never shows its words", () => {
    expect(data.plans).toEqual([
      {
        for: "Khalid",
        date: "2026-11-13",
        note: "Rooftop",
        steps: [{ label: "Gift", done: true }],
      },
      { for: "your own birthday", date: "2026-11-22", note: null, steps: [] },
    ]);
    expect(data.notes_to_future_you).toEqual([
      { opens_on: "2025-11-22", written_on: "2025-01-02", note: "Dear me" },
      { opens_on: "2026-11-22", written_on: "2026-01-02", note: "Sealed until your birthday." },
    ]);
  });

  it("has my profile, people with their days, lists with their wishes, devices", () => {
    expect(data.people).toEqual([
      { name: "Khalid", days: [{ kind: "birthday", day: 13, month: 11 }] },
    ]);
    expect(data.wishlists).toEqual([
      {
        title: "My birthday",
        kind: "birthday",
        shared_with: "your connections",
        wishes: [{ title: "Olive tree" }],
      },
      {
        title: "Treat yourself",
        kind: "treat",
        shared_with: "only you",
        wishes: [{ title: "Concert ticket" }],
      },
    ]);
    expect(data.notification_devices).toEqual([
      { label: "Chrome on Android", added: "2026-11-14", last_used: null },
    ]);
  });

  it("the gifts I reserved, but never anything about reservations on my wishes", () => {
    expect(data.gifts_you_reserved).toEqual([
      { for: "Sara", wish: "Instax", reserved_on: "2026-11-10" },
    ]);
    const text = JSON.stringify(data);
    expect(text).not.toMatch(/reserver|reserved_by|taken|status|p256dh|endpoint/);
    expect(JSON.stringify(data.wishlists)).not.toMatch(/reserv/i);
  });

  it("a dated file name", () => {
    expect(exportFileName("2026-11-16T10:00:00.000Z")).toBe("remember-me-data-2026-11-16.json");
  });
});
