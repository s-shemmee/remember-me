import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

function AccountMenu({ onLogOut = () => {} }: { onLogOut?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="card2">Sara</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>My profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem>Help &amp; feedback</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="accent" onSelect={onLogOut}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe("DropdownMenu", () => {
  it("story: the account menu from the sidebar chip", async () => {
    render(<AccountMenu />);
    await userEvent.click(screen.getByRole("button", { name: "Sara" }));

    // Radix names the menu after its trigger (aria-labelledby).
    const menu = await screen.findByRole("menu", { name: "Sara" });
    expect(menu).toHaveClass("rounded-popover", "bg-card", "shadow-popover", "p-2");
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "My profile",
      "Settings",
      "Help & feedback",
      "Log out",
    ]);
    expect(items[0]).toHaveClass("min-h-11", "rounded-item", "text-sub");
    expect(screen.getByRole("menuitem", { name: "Log out" })).toHaveClass(
      "data-[variant=accent]:text-accent-text",
    );
  });

  it("opens from the keyboard, moves with arrows and selects with Enter", async () => {
    const onLogOut = vi.fn();
    render(<AccountMenu onLogOut={onLogOut} />);

    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("menu");
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "My profile" })).toHaveFocus());

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Log out" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onLogOut).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("closes on Esc and returns focus to the trigger", async () => {
    render(<AccountMenu />);
    const trigger = screen.getByRole("button", { name: "Sara" });
    await userEvent.click(trigger);
    await screen.findByRole("menu");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
