import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Avatar, initialsOf } from "./avatar";
import { Card } from "./card";
import { Chip, FilterChip } from "./chip";
import { Field } from "./field";
import { Noor } from "./noor";
import { NoorBubble } from "./noor-bubble";

describe("Card", () => {
  it("story: a plain card and a hoverable link card", () => {
    render(
      <div>
        <Card>Coming up</Card>
        <Card as="a" href="/people/khalid" interactive>
          Khalid turns 30
        </Card>
      </div>,
    );
    expect(screen.getByText("Coming up")).toHaveClass("rounded-card", "bg-card", "shadow-card");
    const link = screen.getByRole("link", { name: "Khalid turns 30" });
    expect(link).toHaveClass("hover:-translate-y-0.5");
  });
});

describe("Chip", () => {
  it("story: a countdown pill in Khalid's pastel", () => {
    render(<Chip pastel="peach">in 2 days</Chip>);
    expect(screen.getByText("in 2 days")).toHaveClass("bg-peach", "text-peach-ink", "rounded-pill");
  });

  it("story: filter chips toggle and announce their state", async () => {
    function Filters() {
      return (
        <div role="group" aria-label="Filter people">
          <FilterChip selected>All</FilterChip>
          <FilterChip>Family</FilterChip>
        </div>
      );
    }
    render(<Filters />);
    const all = screen.getByRole("button", { name: "All", pressed: true });
    // Pressed: the text colour. Off: white with a line in light (never card2 on the page).
    expect(all).toHaveClass("aria-pressed:bg-text", "aria-pressed:text-bg", "min-h-11");
    expect(screen.getByRole("button", { name: "Family", pressed: false })).toHaveClass(
      "bg-card",
      "shadow-[inset_0_0_0_1.5px_var(--line)]",
    );
    await userEvent.tab();
    expect(all).toHaveFocus();
  });
});

describe("Avatar", () => {
  it("story: initials in the person's pastel", () => {
    render(<Avatar name="Grandma Fatima" pastel="lilac" />);
    const avatar = screen.getByRole("img", { name: "Grandma Fatima" });
    expect(avatar).toHaveTextContent("GF");
    expect(avatar).toHaveClass("bg-lilac", "text-lilac-ink", "font-extrabold", "rounded-pill");
  });

  it("is hidden from screen readers when the name is already shown", () => {
    render(<Avatar name="Omar" pastel="sky" decorative />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it.each([
    ["Omar", "OM"],
    ["Khalid", "KH"],
    ["Yasmine", "YA"],
    ["Grandma Fatima", "GF"],
    ["  Mom & Dad  ", "MD"],
    ["Yasmine El Idrissi", "YI"],
    ["élodie", "ÉL"],
    ["", ""],
  ])("initials of %j are %s", (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

describe("Field", () => {
  it("story: email field with helper text", () => {
    render(<Field label="Email" type="email" helper="We'll never share it." />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAccessibleDescription("We'll never share it.");
    expect(input).toHaveClass("h-[52px]", "rounded-input", "border-[1.5px]", "border-line");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("story: password too short, error as text linked to the input", () => {
    render(
      <Field
        label="Password"
        type="password"
        helper="8+ characters"
        error="Use 8 characters or more"
      />,
    );
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Error: Use 8 characters or more");
    expect(screen.queryByText("8+ characters")).not.toBeInTheDocument();
  });

  it("takes typing", async () => {
    render(<Field label="Name" />);
    await userEvent.type(screen.getByLabelText("Name"), "Sara");
    expect(screen.getByLabelText("Name")).toHaveValue("Sara");
  });
});

describe("Noor", () => {
  it("is decorative by default", () => {
    const { container } = render(<Noor />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("can carry a label, and only animates when asked", () => {
    render(<Noor label="Noor, the candle assistant, waving" size={96} animated />);
    const noor = screen.getByRole("img", { name: "Noor, the candle assistant, waving" });
    expect(noor).toHaveAttribute("width", "96");
    expect(noor).toHaveAttribute("height", "128");
    expect(noor).toHaveClass("animate-bob");
  });

  it("story: calm by default, smiling for welcoming moments", () => {
    const { container } = render(
      <div>
        <Noor />
        <Noor mood="smiling" animated />
      </div>,
    );
    const [calm, smiling] = container.querySelectorAll("[data-slot='noor']");

    expect(calm).toHaveAttribute("data-mood", "calm");
    expect(calm?.querySelectorAll("circle")).toHaveLength(2); // dot eyes
    expect(calm?.querySelector("[data-part='inner-flame']")).toBeNull();

    expect(smiling).toHaveAttribute("data-mood", "smiling");
    expect(smiling?.querySelector("[data-part='eyes']")).toBeInTheDocument(); // arched
    expect(smiling?.querySelector("[data-part='mouth']")).toBeInTheDocument(); // open smile
    expect(smiling?.querySelector("[data-part='inner-flame']")).toHaveClass(
      "fill-noor-flame-inner",
      "animate-flicker",
    );
  });
});

describe("NoorBubble", () => {
  it("story: Noor offers to reserve a gift, announced politely", () => {
    render(
      <NoorBubble live>
        Khalid turns 30 in 2 days 🎂 The football on his wishlist is still free. Want me to reserve
        it for you?
      </NoorBubble>,
    );
    const bubble = screen.getByText(/Khalid turns 30/);
    expect(bubble).toHaveAttribute("aria-live", "polite");
    expect(bubble).toHaveClass("rounded-[22px_22px_22px_6px]", "bg-card");
  });

  it("is not a live region unless asked", () => {
    render(<NoorBubble>hi, I&apos;m Noor 👋</NoorBubble>);
    expect(screen.getByText("hi, I'm Noor 👋")).not.toHaveAttribute("aria-live");
  });
});
