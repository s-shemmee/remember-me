import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TokensPage from "./page";

describe("token check page", () => {
  it("shows a light and a dark panel with the token sections", () => {
    render(<TokensPage />);

    expect(screen.getByRole("heading", { level: 1, name: /design tokens/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Dark" })).toHaveClass("dark");
    expect(screen.getAllByRole("heading", { level: 3, name: "Colours" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Start remembering" })).toHaveLength(2);
  });

  it("shows token values read from globals.css", () => {
    render(<TokensPage />);

    expect(screen.getByText("#f4f5f9")).toBeInTheDocument();
    expect(screen.getByText("#0e0e10")).toBeInTheDocument();
  });
});
