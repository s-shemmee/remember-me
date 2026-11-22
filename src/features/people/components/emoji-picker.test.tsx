import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

// The real picker (frimousse) needs layout and its data; e2e covers it. Here,
// a stand-in with the same contract: a search field and emoji buttons.
vi.mock("next/dynamic", () => ({
  default: () =>
    function Panel({ searchId, onPick }: { searchId: string; onPick: (e: string) => void }) {
      return (
        <div>
          <label htmlFor={searchId}>Search emoji</label>
          <input id={searchId} />
          <button type="button" onClick={() => onPick("☕")}>
            hot beverage
          </button>
        </div>
      );
    },
}));

const { EmojiPicker } = await import("./emoji-picker");

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
  it("opens on the search field; picking closes and returns focus", async () => {
    render(<Harness />);
    expect(trigger()).toHaveTextContent("❤️");
    await userEvent.click(trigger());
    const search = await screen.findByLabelText("Search emoji");
    await waitFor(() => expect(search).toHaveFocus());
    expect(screen.getByRole("dialog", { name: "Emoji for black coffee" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "hot beverage" }));
    expect(value()).toBe("☕");
    expect(screen.queryByLabelText("Search emoji")).toBeNull();
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("Escape closes; Reset to heart sets ❤️", async () => {
    render(<Harness initial="⚽" />);
    await userEvent.click(trigger());
    await screen.findByLabelText("Search emoji");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByLabelText("Search emoji")).toBeNull();
    expect(trigger()).toHaveFocus();

    await userEvent.click(trigger());
    await userEvent.click(await screen.findByRole("button", { name: "Reset to heart" }));
    expect(value()).toBe("❤️");
  });
});
