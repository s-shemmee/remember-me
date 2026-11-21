import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Wishlist } from "../load";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/reservations/actions", () => ({
  reserveWish: vi.fn(),
  cancelReservation: vi.fn(),
  dismissNotice: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: vi.fn() }));
vi.mock("@/features/profile/actions", () => ({ saveTheme: vi.fn() }));

const saveWish = vi.fn();
const removeWish = vi.fn();
const restoreWish = vi.fn();
const reorderWishes = vi.fn();
vi.mock("../actions", () => ({
  saveWish: (...a: unknown[]) => saveWish(...a),
  removeWish: (...a: unknown[]) => removeWish(...a),
  restoreWish: (...a: unknown[]) => restoreWish(...a),
  reorderWishes: (...a: unknown[]) => reorderWishes(...a),
  discardUpload: vi.fn(),
}));
const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
vi.mock("@/components/ui/sonner", () => ({ toast }));

const { WishlistsScreen } = await import("./wishlists-screen");

const USER = "16fd2706-8baf-433b-82eb-8c7fada847da";
const BDAY = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const TREAT = "9b2d9a4e-6a59-4f1e-8b9a-2c1d5e6f7a8b";
const wish = (id: string, title: string, extra = {}) => ({
  id,
  wishlistId: BDAY,
  title,
  url: null,
  price: null,
  currency: "MAD",
  note: null,
  priority: "like" as const,
  imagePath: null,
  imageUrl: null,
  ...extra,
});
const lists: Wishlist[] = [
  {
    id: BDAY,
    kind: "birthday",
    title: "My birthday",
    label: "My birthday · 22 Nov",
    wishes: [
      wish("a0000000-0000-4000-8000-000000000001", "Ottolenghi cookbook", {
        url: "https://www.librairie.ma/x",
        price: 420,
        priority: "love",
      }),
      wish("a0000000-0000-4000-8000-000000000002", "Little olive tree"),
      wish("a0000000-0000-4000-8000-000000000003", "Fig candle"),
    ],
  },
  { id: TREAT, kind: "treat", title: "Treat yourself", label: "Treat yourself", wishes: [] },
];
const renderScreen = () =>
  render(<WishlistsScreen lists={lists} userId={USER} friends={[]} notices={[]} />);
const titles = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
const optionsFor = (title: string) => screen.getByRole("button", { name: `Options for ${title}` });

beforeEach(() => vi.clearAllMocks());

describe("Wishlists", () => {
  it("shows my birthday list with prices, shops, priorities and safe links", () => {
    renderScreen();
    expect(screen.getByRole("tab", { name: "My wishlists" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: "My birthday · 22 Nov" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(titles()).toEqual(["Ottolenghi cookbook", "Little olive tree", "Fig candle"]);
    expect(screen.getByText("420 MAD · librairie.ma")).toBeInTheDocument();
    expect(screen.getByText("Love it")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Open link/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
    expect(link).toHaveAccessibleName("Open link (opens in a new tab)");
  });

  it("the private list says so, and an empty list has Noor", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: "Treat yourself" }));
    expect(
      screen.getByText("Just for you. Only you can see this list · 0 wishes"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Add the first thing you'd love/)).toBeInTheDocument();
  });

  it("Move later / earlier reorder the list and save the new order", async () => {
    reorderWishes.mockResolvedValue({ ok: true });
    renderScreen();
    await userEvent.click(optionsFor("Ottolenghi cookbook"));
    expect(screen.getByRole("menuitem", { name: "Move earlier" })).toHaveAttribute("data-disabled");
    await userEvent.click(screen.getByRole("menuitem", { name: "Move later" }));
    expect(titles()).toEqual(["Little olive tree", "Ottolenghi cookbook", "Fig candle"]);
    expect(reorderWishes).toHaveBeenCalledWith({
      wishlistId: BDAY,
      ids: [
        "a0000000-0000-4000-8000-000000000002",
        "a0000000-0000-4000-8000-000000000001",
        "a0000000-0000-4000-8000-000000000003",
      ],
    });
  });

  it("a failed reorder goes back to the old order", async () => {
    reorderWishes.mockResolvedValue({ ok: false, message: "That order didn't work." });
    renderScreen();
    await userEvent.click(optionsFor("Fig candle"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Move earlier" }));
    await waitFor(() =>
      expect(titles()).toEqual(["Ottolenghi cookbook", "Little olive tree", "Fig candle"]),
    );
    expect(toast.error).toHaveBeenCalledWith("That order didn't work.");
  });

  it("Remove offers Undo", async () => {
    removeWish.mockResolvedValue({ ok: true });
    restoreWish.mockResolvedValue({ ok: true });
    renderScreen();
    await userEvent.click(optionsFor("Fig candle"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    await waitFor(() =>
      expect(removeWish).toHaveBeenCalledWith("a0000000-0000-4000-8000-000000000003"),
    );
    const [message, options] = toast.mock.calls[0]! as [
      string,
      { action: { label: string; onClick: () => Promise<void> } },
    ];
    expect(message).toBe("Fig candle removed");
    expect(options.action.label).toBe("Undo");
    await act(() => options.action.onClick());
    expect(restoreWish).toHaveBeenCalledWith("a0000000-0000-4000-8000-000000000003");
    expect(toast.success).toHaveBeenCalledWith("Fig candle is back");
  });

  it("my own wishes never say whether they're reserved", () => {
    renderScreen();
    expect(screen.queryByText(/reserved|taken|got this|still free/i)).toBeNull();
    expect(screen.getByText(/Your connections can see this list/)).toBeInTheDocument();
    expect(
      screen.getByText(/When your people reserve something, you won't see it\./),
    ).toBeInTheDocument();
  });

  it("the friends tab invites you to bring your people", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("tab", { name: "Friends' wishlists" }));
    expect(screen.getByRole("link", { name: "Invite your people" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });
});

describe("Wish dialog", () => {
  it("only the title is needed; it says what's missing and focuses it", async () => {
    renderScreen();
    await userEvent.click(screen.getAllByRole("button", { name: "Add a wish" })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Add a wish" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Add wish" }));
    const title = within(dialog).getByLabelText("What do you wish for?");
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveAttribute("maxlength", "80");
    await waitFor(() => expect(title).toHaveFocus());
    expect(within(dialog).getByText("Add what you wish for to save.")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(saveWish).not.toHaveBeenCalled();
  });

  it("refuses a link that isn't a web page", async () => {
    renderScreen();
    await userEvent.click(screen.getAllByRole("button", { name: "Add a wish" })[0]!);
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("What do you wish for?"), "Book");
    await userEvent.type(within(dialog).getByLabelText("Link (optional)"), "javascript:alert(1)");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add wish" }));
    expect(within(dialog).getByLabelText("Link (optional)")).toHaveAccessibleDescription(
      /Use a web link that starts with https:\/\//,
    );
    expect(saveWish).not.toHaveBeenCalled();
  });

  it("saves the wish with its priority, price and list", async () => {
    saveWish.mockResolvedValue({ ok: true, id: "x", title: "Hammam day" });
    renderScreen();
    await userEvent.click(screen.getAllByRole("button", { name: "Add a wish" })[0]!);
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("What do you wish for?"), "Hammam day");
    await userEvent.type(within(dialog).getByLabelText("Price (optional)"), "350");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Nice to have" }));
    await userEvent.selectOptions(within(dialog).getByLabelText("Which list?"), TREAT);
    await userEvent.click(within(dialog).getByRole("button", { name: "Add wish" }));
    await waitFor(() => expect(saveWish).toHaveBeenCalledOnce());
    expect(saveWish.mock.calls[0]![0]).toMatchObject({
      title: "Hammam day",
      price: "350",
      currency: "MAD",
      priority: "nice",
      wishlistId: TREAT,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Hammam day added");
    expect(refresh).toHaveBeenCalled();
  });

  it("the photo picker is a real, labelled file input for images only", async () => {
    renderScreen();
    await userEvent.click(screen.getAllByRole("button", { name: "Add a wish" })[0]!);
    const input = within(screen.getByRole("dialog")).getByLabelText("Choose a photo");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    await userEvent.upload(input, new File(["%PDF"], "doc.pdf", { type: "application/pdf" }), {
      applyAccept: false,
    });
    expect(input).toHaveAccessibleDescription(/Use a photo: JPEG, PNG or WebP\./);
  });
});
