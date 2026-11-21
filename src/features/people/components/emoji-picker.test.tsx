import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { EmojiPicker } from "./emoji-picker";

function Harness({ initial = "❤️" }: { initial?: string }) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      <EmojiPicker value={value} label="black coffee" onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

const trigger = () => screen.getByRole("button", { name: "Choose an emoji for black coffee" });
const value = () => screen.getByTestId("value").textContent;

describe("EmojiPicker", () => {
  it("picks from the grid by click; Escape closes and returns focus", async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    const grid = await screen.findByRole("group", { name: "Common emoji" });
    expect(grid.querySelectorAll("button")).toHaveLength(48);
    await userEvent.click(screen.getByRole("button", { name: "coffee" }));
    expect(value()).toBe("☕");
    expect(screen.queryByRole("group", { name: "Common emoji" })).toBeNull();

    await userEvent.click(trigger());
    await screen.findByRole("group", { name: "Common emoji" });
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Common emoji" })).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it("keyboard: arrows move in the grid (8 per row), Enter picks", async () => {
    render(<Harness initial="☕" />);
    await userEvent.click(trigger());
    const coffee = await screen.findByRole("button", { name: "coffee" });
    await waitFor(() => expect(coffee).toHaveFocus());
    expect(coffee).toHaveAttribute("aria-pressed", "true");
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "tea" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "strawberry" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(value()).toBe("🍓");
  });

  it("type any emoji (exactly one), or reset to the heart", async () => {
    render(<Harness initial="⚽" />);
    await userEvent.click(trigger());
    const field = await screen.findByLabelText("Or type any emoji");
    await userEvent.type(field, "tea{Enter}");
    expect(field).toHaveAccessibleDescription("Error: Type or paste one emoji.");
    expect(value()).toBe("⚽");
    await userEvent.clear(field);
    await userEvent.type(field, "🦉{Enter}");
    expect(value()).toBe("🦉");

    await userEvent.click(trigger());
    await userEvent.click(await screen.findByRole("button", { name: "Reset to heart" }));
    expect(value()).toBe("❤️");
  });
});
