import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { reauthModeFor } = await import("@/features/account/reauth");
const { buildExport, exportFileName } = await import("@/features/account/export");
const { squareCrop } = await import("./avatar-image");
const { isTimeZone, profileSchema, signedInRecently, REAUTH_WINDOW_SECONDS } =
  await import("./schema");

const valid = {
  firstName: "Maya",
  look: { kind: "initials", color: "lilac", character: null, photoPath: null },
  birthday: { day: 22, month: 11, year: null },
  timezone: "Africa/Casablanca",
};

describe("About you", () => {
  it("accepts a normal profile", () => {
    expect(profileSchema.safeParse(valid).success).toBe(true);
  });

  it("first name: needed, up to 40 characters", () => {
    expect(profileSchema.safeParse({ ...valid, firstName: "  " }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, firstName: "x".repeat(41) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, firstName: "x".repeat(40) }).success).toBe(true);
  });

  it("birthday: a real date; 29 February only with a leap year (or no year)", () => {
    const bday = (day: number, month: number, year: number | null) =>
      profileSchema.safeParse({ ...valid, birthday: { day, month, year } }).success;
    expect(bday(31, 4, null)).toBe(false);
    expect(bday(29, 2, null)).toBe(true);
    expect(bday(29, 2, 2000)).toBe(true);
    expect(bday(29, 2, 2001)).toBe(false);
    expect(bday(1, 1, new Date().getFullYear() + 1)).toBe(false);
  });

  it("look: a photo needs a photo, a character needs a character", () => {
    expect(
      profileSchema.safeParse({ ...valid, look: { ...valid.look, kind: "photo" } }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ ...valid, look: { ...valid.look, kind: "character" } }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({
        ...valid,
        look: { ...valid.look, kind: "character", character: "fox" },
      }).success,
    ).toBe(true);
  });

  it("time zone: one this runtime knows", () => {
    expect(isTimeZone("Europe/London")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("../../etc")).toBe(false);
    expect(profileSchema.safeParse({ ...valid, timezone: "Nope/Nowhere" }).success).toBe(false);
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
