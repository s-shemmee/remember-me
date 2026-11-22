import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("@/features/messages/actions", () => ({
  draftNoorMessages: vi.fn(),
  saveMessageInPlan: vi.fn(),
  messageContext: vi.fn(),
}));
vi.mock("@/features/ask-noor/actions", () => ({ askNoor: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const reserveWish = vi.fn();
vi.mock("@/features/reservations/actions", () => ({
  reserveWish: (...a: unknown[]) => reserveWish(...a),
  cancelReservation: vi.fn(),
  dismissNotice: vi.fn(),
}));
const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
vi.mock("@/components/ui/sonner", () => ({ toast }));
vi.mock("@/features/gift-ideas/actions", () => ({
  addGiftIdeaToPlan: vi.fn(),
  newGiftIdeas: vi.fn(),
  savedGiftIdeas: vi.fn(async () => null),
}));
vi.mock("@/features/plans/actions", () => ({
  startPlan: vi.fn(),
  tickStep: vi.fn(),
  renameStep: vi.fn(),
  removeStep: vi.fn(),
  addStep: vi.fn(),
  saveNote: vi.fn(),
}));

const { NoorNudge } = await import("./noor-nudge");

const offer = {
  wishId: "w1",
  wishTitle: "match ball",
  friendId: "p-khalid",
  friendName: "Khalid",
  text: "Khalid turns 30 in 2 days 🎂 The match ball (350 MAD) on Khalid's wishlist is still free. Want me to reserve it for you?",
};
const renderNudge = (withOffer = true) =>
  render(
    <NoorNudge
      text="Khalid turns 30 in 2 days 🎂"
      personId="person-khalid"
      name="Khalid"
      isYou={false}
      offer={withOffer ? offer : null}
      today="2026-11-11"
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("Noor's nudge on Home", () => {
  it("offers the wish by name and price", () => {
    renderNudge();
    expect(screen.getByText(offer.text)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reserve it" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Later" })).toBeInTheDocument();
  });

  it("Reserve it reserves that wish, with Undo", async () => {
    reserveWish.mockResolvedValue({ ok: true });
    renderNudge();
    await userEvent.click(screen.getByRole("button", { name: "Reserve it" }));
    expect(reserveWish).toHaveBeenCalledWith("w1");
    expect(screen.getByText("Reserved! Only you know 🤫")).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(
      "Reserved for Khalid",
      expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) }),
    );
    expect(screen.getByRole("link", { name: "See Khalid's wishlist" })).toHaveAttribute(
      "href",
      "/wishlists?tab=friends&friend=p-khalid",
    );
  });

  it("a lost race says so", async () => {
    reserveWish.mockResolvedValue({ ok: false, code: "taken", message: "x" });
    renderNudge();
    await userEvent.click(screen.getByRole("button", { name: "Reserve it" }));
    expect(screen.getByText(/Just taken by someone else/)).toBeInTheDocument();
  });

  it("Later waits until tomorrow", async () => {
    const { unmount } = renderNudge();
    await userEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.getByText("No worries, I'll ask again tomorrow ☀️")).toBeInTheDocument();
    unmount();
    renderNudge();
    expect(screen.queryByRole("button", { name: "Reserve it" })).toBeNull();
    expect(screen.getByText("Khalid turns 30 in 2 days 🎂")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Khalid" })).toBeInTheDocument();
  });

  it("without a free wish it's the plain nudge", () => {
    renderNudge(false);
    expect(screen.queryByRole("button", { name: "Reserve it" })).toBeNull();
    expect(screen.getByRole("link", { name: "Open Khalid" })).toHaveAttribute(
      "href",
      "/people?person=person-khalid",
    );
  });
});
