import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SkipLink } from "./skip-link";

describe("SkipLink", () => {
  it("focuses the visible main when a hidden previous page is still in the document", async () => {
    render(
      <>
        <SkipLink />
        <main id="main" data-testid="hidden">
          old page
        </main>
        <main id="main" data-testid="visible">
          new page
        </main>
      </>,
    );
    // jsdom has no layout: say which one is rendered.
    const visible = screen.getByTestId("visible");
    visible.getClientRects = () => [{}] as unknown as DOMRectList;
    screen.getByTestId("hidden").getClientRects = () => [] as unknown as DOMRectList;
    visible.scrollIntoView = () => {};

    await userEvent.click(screen.getByRole("link", { name: "Skip to content" }));
    expect(visible).toHaveFocus();
    expect(visible).toHaveAttribute("tabindex", "-1");
  });
});
