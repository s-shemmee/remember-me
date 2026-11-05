import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TokensPage from "./page";

describe("token check page", () => {
  it("shows a light and a dark panel with the token sections", () => {
    render(<TokensPage />);

    expect(screen.getByRole("heading", { level: 1, name: /design tokens/i })).toBeInTheDocument();
    const light = screen.getByRole("region", { name: "Light" });
    const dark = screen.getByRole("region", { name: "Dark" });
    // Each panel pins its theme, whatever the page theme is.
    expect(light).toHaveClass("light");
    expect(dark).toHaveClass("dark");
    for (const panel of [light, dark]) {
      expect(within(panel).getByRole("heading", { level: 3, name: "Colours" })).toBeInTheDocument();
      expect(within(panel).getByRole("button", { name: "Start remembering" })).toBeInTheDocument();
    }
  });

  it("shows the components with a theme switcher", () => {
    render(<TokensPage />);

    const components = screen.getByRole("region", { name: "Components" });
    const theme = within(components).getByRole("group", { name: "Theme" });
    expect(
      within(theme).getByRole("button", { name: "System", pressed: true }),
    ).toBeInTheDocument();
    expect(within(theme).getByRole("button", { name: "Dark", pressed: false })).toBeInTheDocument();
  });

  it("shows token values read from globals.css", () => {
    render(<TokensPage />);

    expect(screen.getByText("#f4f5f9")).toBeInTheDocument();
    expect(screen.getByText("#0e0e10")).toBeInTheDocument();
  });
});
