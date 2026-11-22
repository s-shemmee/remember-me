import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { inboxItem, type InboxRow, whenLabel } from "./text";

const today = { year: 2026, month: 11, day: 21 };
const row = (over: Partial<InboxRow>): InboxRow => ({
  id: "n1",
  kind: "wishlist_update",
  read: false,
  at: "2026-11-21T09:00:00Z",
  actor_id: "p-yasmine",
  actor_name: "Yasmine",
  person_id: null,
  person_name: null,
  occasion_kind: null,
  birth_year: null,
  occurs_on: null,
  wish_count: 2,
  plan_done: null,
  plan_total: null,
  ...over,
});

describe("inbox wording", () => {
  it("wishlist updates: who and how many, linking to their list, never pronouns", () => {
    expect(inboxItem(row({}), today)).toMatchObject({
      text: "Yasmine added 2 wishes to their birthday list.",
      href: "/wishlists?tab=friends&friend=p-yasmine",
    });
    expect(inboxItem(row({ wish_count: 1 }), today)!.text).toBe(
      "Yasmine added 1 wish to their birthday list.",
    );
  });

  it("invite accepted", () => {
    expect(inboxItem(row({ kind: "invite_accepted", actor_name: "Omar" }), today)!.text).toBe(
      "Omar accepted your invite. You can now see each other's wishlists.",
    );
  });

  it("someone who joined and isn't one of your people yet: the question, to People", () => {
    const joined = row({ kind: "invite_accepted", actor_name: "Chama", actor_id: "c1" });
    expect(inboxItem(joined, today, new Set(["b1"]))).toMatchObject({
      text: "Chama joined through your link. Is this someone you already added?",
      href: "/people?link=c1",
    });
    // Once linked, the usual line.
    expect(inboxItem(joined, today, new Set(["c1"]))!.text).toMatch(/accepted your invite/);
  });

  it("reminders: turning N with a known year, the plan, a link to the person", () => {
    const r = row({
      kind: "reminder",
      actor_id: null,
      actor_name: null,
      person_id: "per-1",
      person_name: "Khalid",
      occasion_kind: "birthday",
      birth_year: 1996,
      occurs_on: "2026-11-23",
      plan_done: 1,
      plan_total: 4,
    });
    expect(inboxItem(r, today)).toMatchObject({
      text: "Khalid turns 30 in 2 days. Your plan is 1 of 4 done.",
      href: "/people?person=per-1",
    });
    expect(
      inboxItem({ ...r, birth_year: null, plan_total: 0, occasion_kind: "anniversary" }, today)!
        .text,
    ).toBe("Khalid's anniversary is in 2 days.");
    expect(inboxItem({ ...r, occurs_on: "2026-11-19", birth_year: null }, today)!.text).toBe(
      "Khalid's birthday was on Thu, 19 Nov.",
    );
    // A person since removed: nothing to show.
    expect(inboxItem({ ...r, person_name: null }, today)).toBeNull();
  });

  it("no emoji anywhere in the inbox text", () => {
    const texts = [
      row({}),
      row({ kind: "invite_accepted" }),
      row({
        kind: "reminder",
        person_name: "Khalid",
        occasion_kind: "birthday",
        occurs_on: "2026-11-23",
      }),
    ].map((r) => inboxItem(r, today)!.text);
    for (const t of texts) expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("when: Today, Yesterday, then the date", () => {
    expect(whenLabel("2026-11-21T08:00:00Z", today, "UTC")).toBe("Today");
    expect(whenLabel("2026-11-20T08:00:00Z", today, "UTC")).toBe("Yesterday");
    expect(whenLabel("2026-11-15T08:00:00Z", today, "UTC")).toBe("Sun, 15 Nov");
  });
});

// The bell ---------------------------------------------------------------------------------------
const loadInbox = vi.fn();
const markInboxRead = vi.fn();
vi.mock("./actions", () => ({
  loadInbox: () => loadInbox(),
  markInboxRead: (a: unknown) => markInboxRead(a),
  setWishlistUpdates: vi.fn(),
}));
const { InboxBell } = await import("./components/inbox-bell");

const items = [
  {
    id: "a",
    read: false,
    at: "",
    when: "Today",
    text: "Yasmine added 2 wishes to their birthday list.",
    href: "/wishlists",
  },
  {
    id: "b",
    read: true,
    at: "",
    when: "Yesterday",
    text: "Omar accepted your invite. You can now see each other's wishlists.",
    href: "/wishlists",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  markInboxRead.mockResolvedValue({ ok: true });
});

describe("InboxBell", () => {
  it("shows the unread count, opens the inbox, and marks all as read", async () => {
    loadInbox.mockResolvedValue({ items, unread: 1 });
    render(<InboxBell />);
    const bell = await screen.findByRole("button", { name: "Notifications, 1 unread" });
    await userEvent.click(bell);
    expect(await screen.findByText("Yasmine added 2 wishes to their birthday list.")).toBeVisible();
    expect(screen.getByText("Unread:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notification settings" })).toHaveAttribute(
      "href",
      "/settings/notifications",
    );
    await userEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(markInboxRead).toHaveBeenCalledWith({ ids: null });
    // Announced, and nothing unread any more.
    expect(await screen.findByText("All marked as read")).toBeInTheDocument();
    expect(screen.queryByText("Unread:")).toBeNull();
    expect(screen.getByText("Nothing new")).toBeVisible();
  });

  it("the empty state", async () => {
    loadInbox.mockResolvedValue({ items: [], unread: 0 });
    render(<InboxBell />);
    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("You're all caught up.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
  });
});
