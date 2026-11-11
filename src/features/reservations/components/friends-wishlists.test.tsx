import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Friend, FriendWish } from "../logic";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const reserveWish = vi.fn();
const cancelReservation = vi.fn();
const dismissNotice = vi.fn();
vi.mock("../actions", () => ({
  reserveWish: (...a: unknown[]) => reserveWish(...a),
  cancelReservation: (...a: unknown[]) => cancelReservation(...a),
  dismissNotice: (...a: unknown[]) => dismissNotice(...a),
}));
const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
vi.mock("@/components/ui/sonner", () => ({ toast }));

const { FriendsWishlists } = await import("./friends-wishlists");

const wish = (id: string, title: string, extra: Partial<FriendWish> = {}): FriendWish => ({
  id,
  title,
  url: null,
  price: null,
  currency: "MAD",
  note: null,
  priority: "like",
  imageUrl: null,
  status: "free",
  ...extra,
});
const friends: Friend[] = [
  {
    profileId: "p-khalid",
    name: "Khalid",
    pastel: "butter",
    character: null,
    birthday: { day: 13, month: 11 },
    daysUntil: 2,
    linkedPersonId: null,
    wishes: [
      wish("w1", "Adidas match ball", { price: 450, url: "https://decathlon.ma/ball" }),
      wish("w2", "Wireless earbuds", { status: "mine" }),
      wish("w3", "Raja cap", { status: "taken" }),
    ],
  },
  {
    profileId: "p-nadia",
    name: "Nadia",
    pastel: "lilac",
    character: null,
    birthday: { day: 5, month: 12 },
    daysUntil: 24,
    linkedPersonId: null,
    wishes: [],
  },
];

const renderTab = (props: Partial<Parameters<typeof FriendsWishlists>[0]> = {}) => {
  const onFriendChange = vi.fn();
  render(
    <FriendsWishlists
      friends={friends}
      notices={[]}
      friendId={null}
      onFriendChange={onFriendChange}
      {...props}
    />,
  );
  return { onFriendChange };
};
const card = (title: string) =>
  screen.getByRole("heading", { level: 3, name: title }).closest("li")!;

beforeEach(() => vi.clearAllMocks());

describe("Friends' wishlists", () => {
  it("lists friends by birthday and shows the first one's wishes in three states", () => {
    renderTab();
    const picker = screen.getByRole("group", { name: "Friends" });
    const buttons = within(picker).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "KHKhalidBirthday in 2 days",
      "NANadiaBirthday in 24 days",
    ]);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Khalid's birthday wishlist" })).toBeInTheDocument();

    expect(
      within(card("Adidas match ball")).getByRole("button", {
        name: "Reserve it: Adidas match ball",
      }),
    ).toBeInTheDocument();
    expect(within(card("Wireless earbuds")).getByText(/Reserved by you/)).toBeInTheDocument();
    expect(
      within(card("Wireless earbuds")).getByRole("button", {
        name: "Cancel my reservation: Wireless earbuds",
      }),
    ).toBeInTheDocument();
    expect(within(card("Raja cap")).getByText(/Already taken/)).toBeInTheDocument();
    expect(within(card("Raja cap")).queryByRole("button")).toBeNull();
    const link = within(card("Adidas match ball")).getByRole("link", {
      name: "Open link for Adidas match ball (opens in a new tab)",
    });
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText(/you have 1 gift reserved for Khalid/)).toBeInTheDocument();
  });

  it("picking a friend tells the parent (it goes in the URL)", async () => {
    const { onFriendChange } = renderTab();
    await userEvent.click(screen.getByRole("button", { name: /Nadia/ }));
    expect(onFriendChange).toHaveBeenCalledWith("p-nadia");
  });

  it("a friend with no wishes yet", () => {
    renderTab({ friendId: "p-nadia" });
    expect(screen.getByText(/Nadia hasn't added any wishes yet/)).toBeInTheDocument();
  });

  it("Reserve it: reserved at once, with a 'Reserved for Khalid 🤫' toast and Undo", async () => {
    reserveWish.mockResolvedValue({ ok: true });
    cancelReservation.mockResolvedValue({ ok: true });
    renderTab();
    await userEvent.click(screen.getByRole("button", { name: "Reserve it: Adidas match ball" }));
    expect(reserveWish).toHaveBeenCalledWith("w1");
    expect(within(card("Adidas match ball")).getByText(/Reserved by you/)).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(
      "Reserved for Khalid 🤫",
      expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) }),
    );
    expect(screen.getByText(/you have 2 gifts reserved for Khalid/)).toBeInTheDocument();

    const undo = toast.mock.calls[0]![1].action.onClick as () => void;
    undo();
    await waitFor(() => expect(cancelReservation).toHaveBeenCalledWith("w1"));
    await waitFor(() =>
      expect(
        within(card("Adidas match ball")).getByRole("button", { name: /Reserve it/ }),
      ).toBeInTheDocument(),
    );
  });

  it("a lost race says 'Just taken by someone else'", async () => {
    reserveWish.mockResolvedValue({
      ok: false,
      code: "taken",
      message: "Just taken by someone else",
    });
    renderTab();
    await userEvent.click(screen.getByRole("button", { name: "Reserve it: Adidas match ball" }));
    const c = card("Adidas match ball");
    expect(within(c).getByText("Just taken by someone else")).toBeInTheDocument();
    expect(within(c).getByText(/Already taken/)).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
  });

  it("cancelling my reservation frees the wish", async () => {
    cancelReservation.mockResolvedValue({ ok: true });
    renderTab();
    await userEvent.click(
      screen.getByRole("button", { name: "Cancel my reservation: Wireless earbuds" }),
    );
    expect(cancelReservation).toHaveBeenCalledWith("w2");
    expect(
      within(card("Wireless earbuds")).getByRole("button", { name: /Reserve it/ }),
    ).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith("Wireless earbuds is free again");
  });

  it("shows the quiet note and hides it with OK", async () => {
    dismissNotice.mockResolvedValue({ ok: true });
    renderTab({ notices: [{ id: "n1", text: "Khalid removed a wish you'd reserved" }] });
    expect(screen.getByText("Khalid removed a wish you'd reserved")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "OK, hide the note: Khalid removed a wish you'd reserved",
      }),
    );
    expect(dismissNotice).toHaveBeenCalledWith("n1");
    expect(screen.queryByText("Khalid removed a wish you'd reserved")).toBeNull();
  });

  it("no connections yet: invite your people", () => {
    renderTab({ friends: [] });
    expect(screen.getByRole("link", { name: "Invite your people" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });
});
