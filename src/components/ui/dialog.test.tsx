import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

function RemovePersonDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="card2">Remove Omar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Omar?</DialogTitle>
          <DialogDescription>His days and wishlist notes go too.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="card2">Keep Omar</Button>
          </DialogClose>
          <Button>Remove</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("story: confirm removing a person", async () => {
    render(<RemovePersonDialog />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Omar" }));

    const dialog = await screen.findByRole("dialog", { name: "Remove Omar?" });
    expect(dialog).toHaveAccessibleDescription("His days and wishlist notes go too.");
    expect(dialog).toHaveClass("rounded-card-lg", "bg-card", "shadow-card");
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("size-11");
  });

  it("closes on Esc and gives focus back to the trigger", async () => {
    render(<RemovePersonDialog />);
    const trigger = screen.getByRole("button", { name: "Remove Omar" });
    await userEvent.click(trigger);
    await screen.findByRole("dialog");

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("keeps focus inside while open", async () => {
    render(<RemovePersonDialog />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Omar" }));
    const dialog = await screen.findByRole("dialog");

    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });
});
