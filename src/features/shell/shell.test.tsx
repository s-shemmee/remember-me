import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/people";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const logOut = vi.fn();
vi.mock("@/features/auth/actions", () => ({ logOut: () => logOut() }));
const clearOnboardingDraft = vi.fn();
vi.mock("@/features/onboarding/store", () => ({
  clearOnboardingDraft: () => clearOnboardingDraft(),
}));

const { AppShell } = await import("./app-shell");

const account = { firstName: "Maya", color: "rose" as const, character: null, peopleCount: 7 };

beforeEach(() => {
  pathname = "/people";
  vi.clearAllMocks();
});

describe("App shell", () => {
  it("has the five sections in the sidebar and the tab bar, with the current page marked", () => {
    render(
      <AppShell account={account} yourDay={{ daysUntil: 18, date: "Sun, 22 Nov" }}>
        <main id="main">page</main>
      </AppShell>,
    );
    const [sidebar, tabs] = screen.getAllByRole("navigation", { name: "Main" });
    for (const nav of [sidebar!, tabs!]) {
      expect(
        within(nav)
          .getAllByRole("link")
          .map((a) => a.getAttribute("href")),
      ).toEqual(["/home", "/people", "/calendar", "/wishlists", "/celebrate"]);
      expect(within(nav).getByRole("link", { name: "People" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
    expect(within(sidebar!).getByRole("link", { name: "Celebrate Me" })).toBeInTheDocument();
    expect(within(tabs!).getByRole("link", { name: "Celebrate" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("shows your day: a countdown to your birthday, linking to Celebrate Me", () => {
    const { rerender } = render(
      <AppShell account={account} yourDay={{ daysUntil: 18, date: "Sun, 22 Nov" }}>
        x
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: /YOUR DAY\s*18 days\s*Sun, 22 Nov/ })).toHaveAttribute(
      "href",
      "/celebrate",
    );
    rerender(
      <AppShell account={account} yourDay={{ daysUntil: 0, date: "Sun, 22 Nov" }}>
        x
      </AppShell>,
    );
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("the account chip opens the menu: profile, settings, help, log out", async () => {
    render(
      <AppShell account={account} yourDay={null}>
        x
      </AppShell>,
    );
    const chip = screen.getByRole("button", { name: /^Maya\s*7 people\s*, account menu$/ });
    expect(chip).toHaveAttribute("aria-haspopup", "menu");
    await userEvent.click(chip);
    const menu = screen.getByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent?.trim()),
    ).toEqual(["👤 My profile", "⚙️ Settings", "💬 Help & feedback", "↪ Log out"]);
    expect(within(menu).getByRole("menuitem", { name: /My profile/ })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(within(menu).getByRole("menuitem", { name: /Help/ })).toHaveAttribute(
      "href",
      "mailto:hello@shemme.codes",
    );

    await userEvent.click(within(menu).getByRole("menuitem", { name: /Log out/ }));
    expect(clearOnboardingDraft).toHaveBeenCalledOnce();
    expect(logOut).toHaveBeenCalledOnce();
  });

  it("on phones the avatar opens the same menu", async () => {
    render(
      <AppShell account={{ ...account, peopleCount: 1 }} yourDay={null}>
        x
      </AppShell>,
    );
    expect(screen.getByText("1 person")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Account menu for Maya" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});
