import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/inbox/actions", () => ({
  loadInbox: vi.fn(async () => null),
  markInboxRead: vi.fn(),
  setWishlistUpdates: vi.fn(),
}));
vi.mock("@/features/profile/actions", () => ({ saveTheme: vi.fn() }));

const { HeaderSearch } = await import("./header-actions");
const { HeaderLabel, PageHeader } = await import("./page-header");

/** The header's controls in DOM order (what keyboard and screen reader users meet). */
const order = () =>
  Array.from(
    document.querySelector("[data-slot=page-header]")!.querySelectorAll("a, button, input"),
  ).map(
    (el) =>
      el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? el.textContent?.trim(),
  );

describe("PageHeader", () => {
  it("always: search, primary, theme, bell (bell last)", () => {
    render(
      <PageHeader
        title="People"
        search={
          <HeaderSearch inputId="s" label="Search people">
            <input id="s" placeholder="Search people…" />
          </HeaderSearch>
        }
        primary={
          <button>
            <HeaderLabel>Add someone</HeaderLabel>
          </button>
        }
        bell
      />,
    );
    expect(order()).toEqual([
      "Search people…",
      "Search people",
      "Add someone",
      "Switch to dark mode",
      "Notifications",
    ]);
    expect(screen.getByRole("heading", { level: 1, name: "People" })).toBeInTheDocument();
  });

  it("skips what a page doesn't have; the bell off leaves nothing behind", () => {
    render(<PageHeader title="Settings" theme={false} bell={false} />);
    expect(order()).toEqual([]);
    expect(screen.queryByRole("link", { name: "Notifications" })).toBeNull();
  });

  it("the bell is a button that opens the inbox", () => {
    render(<PageHeader title="Home" theme={false} bell />);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("on phones the search is a button that opens the field (aria-expanded)", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <PageHeader
        title="Home"
        theme={false}
        bell={false}
        search={
          <HeaderSearch inputId="q" label="Search people">
            <input id="q" />
          </HeaderSearch>
        }
      />,
    );
    const toggle = screen.getByRole("button", { name: "Search people" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).toHaveClass("flex");
  });
});
