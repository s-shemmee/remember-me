import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LogInPanel, SignUpPanel } from "./panels";

const delays = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>("[class*='animate-panel-in']")].map(
    (el) => el.className.match(/\[--in-delay:(\d+)ms\]/)?.[1],
  );

describe("SignUpPanel", () => {
  it("story: notification, Celebrate card, handwritten note and Noor's two bubbles", () => {
    render(<SignUpPanel />);
    expect(screen.getByText("Sara's birthday is tomorrow")).toBeInTheDocument();
    expect(screen.getByText("12 days")).toBeInTheDocument();
    expect(screen.getByText("free, forever ✨")).toHaveClass("font-hand", "text-lilac-ink");
    expect(screen.getByText("hi! I'm Noor 👋")).toBeInTheDocument();
  });

  it("fades items in once at 0.2s, 0.7s, 1.2s and 1.7s", () => {
    const { container } = render(<SignUpPanel />);
    expect(new Set(delays(container))).toEqual(new Set(["200", "700", "1200", "1700"]));
  });

  it("floats only the Celebrate card, and only a few times (no infinite loop class)", () => {
    const { container } = render(<SignUpPanel />);
    const floating = container.querySelectorAll("[data-motion='float']");
    expect(floating).toHaveLength(1);
    expect(floating[0]).toHaveTextContent("CELEBRATE ME");
    expect(floating[0]).toHaveClass("animate-panel-in-float");
  });

  it("shows Noor smiling, bobbing", () => {
    const { container } = render(<SignUpPanel />);
    const noor = container.querySelector("[data-slot='noor']");
    expect(noor).toHaveAttribute("data-mood", "smiling");
    expect(noor).toHaveClass("animate-bob");
  });
});

describe("LogInPanel", () => {
  it("story: the example month with two-letter initials, titled without 'EXAMPLE'", () => {
    render(<LogInPanel />);
    expect(screen.getByText("A MONTH IN REMEMBER ME")).toBeInTheDocument();
    expect(screen.queryByText(/EXAMPLE/)).not.toBeInTheDocument();
    for (const initials of ["KH", "MD", "YA"])
      expect(screen.getByText(initials)).toBeInTheDocument();
  });

  it("floats only the date card, and fades the rest in with the same stagger", () => {
    const { container } = render(<LogInPanel />);
    const floating = container.querySelectorAll("[data-motion='float']");
    expect(floating).toHaveLength(1);
    expect(floating[0]).toHaveClass("size-[170px]");
    expect(new Set(delays(container))).toEqual(new Set(["200", "700", "1200", "1700"]));
  });
});
