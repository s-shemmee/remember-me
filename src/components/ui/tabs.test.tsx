import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function WishlistTabs() {
  return (
    <Tabs defaultValue="mine">
      <TabsList aria-label="Wishlists">
        <TabsTrigger value="mine">My wishlists</TabsTrigger>
        <TabsTrigger value="friends">Friends&apos; wishlists</TabsTrigger>
      </TabsList>
      <TabsContent value="mine">Your wishes live here.</TabsContent>
      <TabsContent value="friends">Wishes your people shared with you.</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("story: My wishlists / Friends' wishlists segmented control", () => {
    render(<WishlistTabs />);
    expect(screen.getByRole("tablist", { name: "Wishlists" })).toHaveClass(
      "rounded-pill",
      "bg-card2",
    );
    const mine = screen.getByRole("tab", { name: "My wishlists" });
    expect(mine).toHaveAttribute("aria-selected", "true");
    expect(mine).toHaveClass("min-h-11", "data-active:bg-card", "data-active:shadow-card");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Your wishes live here.");
  });

  it("moves between tabs with the arrow keys", async () => {
    render(<WishlistTabs />);
    await userEvent.tab();
    expect(screen.getByRole("tab", { name: "My wishlists" })).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    const friends = screen.getByRole("tab", { name: "Friends' wishlists" });
    expect(friends).toHaveFocus();
    expect(friends).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Wishes your people shared with you.");
  });
});
