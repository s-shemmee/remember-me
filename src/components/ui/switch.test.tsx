import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Switch } from "./switch";

describe("Switch", () => {
  it("story: the Settings reminder switches", () => {
    render(
      <div>
        <Switch aria-label="By email" defaultChecked />
        <Switch aria-label="Notifications on this device" />
      </div>,
    );
    expect(screen.getByRole("switch", { name: "By email" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Notifications on this device" })).not.toBeChecked();
  });

  it("toggles with Space and reports the change", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Connection requests" onCheckedChange={onCheckedChange} />);
    const sw = screen.getByRole("switch", { name: "Connection requests" });

    await userEvent.tab();
    expect(sw).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(sw).toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("is 48×28 with a 44px tall touch area, outlined in sub when off", () => {
    render(<Switch aria-label="Remind my people" />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveClass("h-7", "w-12", "before:-inset-y-2");
    expect(sw.className).toContain("data-unchecked:shadow-[inset_0_0_0_1.5px_var(--sub)]");
    expect(sw).toHaveClass("data-checked:bg-accent");
  });

  it("works with a visible label", async () => {
    render(
      <div>
        <label htmlFor="remind">Remind my people about my birthday</label>
        <Switch id="remind" />
      </div>,
    );
    await userEvent.click(screen.getByText("Remind my people about my birthday"));
    expect(
      screen.getByRole("switch", { name: "Remind my people about my birthday" }),
    ).toBeChecked();
  });
});
