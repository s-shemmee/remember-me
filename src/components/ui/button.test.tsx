import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button (pill)", () => {
  it("story: main CTA, secondary and quiet buttons side by side", () => {
    render(
      <div>
        <Button size="lg">Start remembering</Button>
        <Button variant="card2">See how it works</Button>
        <Button variant="transparent">Skip for now</Button>
      </div>,
    );

    const cta = screen.getByRole("button", { name: "Start remembering" });
    expect(cta).toHaveClass("rounded-pill", "bg-accent", "text-on-accent", "min-h-[54px]");
    expect(screen.getByRole("button", { name: "See how it works" })).toHaveClass(
      "bg-card2",
      "min-h-11",
    );
    expect(screen.getByRole("button", { name: "Skip for now" })).toHaveClass("bg-transparent");
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("can still submit when asked", () => {
    render(<Button type="submit">Create account</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("is reachable and clickable by keyboard", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add person</Button>);
    await userEvent.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders a link with pill styles via asChild", () => {
    render(
      <Button asChild variant="card2">
        <a href="/people">See everyone</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "See everyone" });
    expect(link).toHaveClass("rounded-pill", "bg-card2");
    expect(link).not.toHaveAttribute("type");
  });

  it("an icon button is 44×44 and needs a label", () => {
    render(
      <Button size="icon" variant="transparent" aria-label="Close">
        ×
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("size-11");
  });

  it("lets a className override its radius", () => {
    render(<Button className="rounded-card">Odd one</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("rounded-card");
    expect(button).not.toHaveClass("rounded-pill");
  });
});
