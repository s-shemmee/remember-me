import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const unsubscribeEmail = vi.fn();
vi.mock("../unsubscribe-action", () => ({
  unsubscribeEmail: (...a: unknown[]) => unsubscribeEmail(...a),
}));

const { UnsubscribeForm } = await import("./unsubscribe-form");

// Shape only (the function checks the signature): low-entropy on purpose.
const TOKEN = `16fd2706-8baf-433b-82eb-8c7fada847da.${"A".repeat(43)}`;

beforeEach(() => vi.clearAllMocks());

describe("/unsubscribe", () => {
  it("asks first, with one button; nothing happens just by opening the link", () => {
    render(<UnsubscribeForm token={TOKEN} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Stop reminder emails?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unsubscribe" })).toBeInTheDocument();
    expect(unsubscribeEmail).not.toHaveBeenCalled();
  });

  it("Unsubscribe: done, focus on the new heading, a way back to Settings", async () => {
    unsubscribeEmail.mockResolvedValue({ status: "done" });
    render(<UnsubscribeForm token={TOKEN} />);
    await userEvent.click(screen.getByRole("button", { name: "Unsubscribe" }));
    const heading = await screen.findByRole("heading", { name: "Done. No more reminder emails" });
    expect(heading).toHaveFocus();
    expect(unsubscribeEmail.mock.calls[0]![1].get("token")).toBe(TOKEN);
    expect(screen.getByRole("link", { name: "Open Settings" })).toHaveAttribute(
      "href",
      "/settings/reminders",
    );
  });

  it("a broken link says so", () => {
    render(<UnsubscribeForm token="" />);
    expect(screen.getByRole("heading", { name: "This link doesn't work" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unsubscribe" })).toBeNull();
  });
});
