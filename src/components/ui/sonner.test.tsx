import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ACTION_TOAST_MIN_MS, Toaster, toast, withActionMinimum } from "./sonner";

afterEach(() => {
  act(() => toast.dismiss());
});

describe("toast", () => {
  it("story: Undo after removing a person", async () => {
    render(<Toaster />);
    act(() => {
      toast("Omar removed", { action: { label: "Undo", onClick: () => {} } });
    });
    expect(await screen.findByText("Omar removed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("keeps toasts with an action for at least 6 seconds", () => {
    const action = { label: "Undo", onClick: () => {} };
    expect(withActionMinimum({ action })?.duration).toBe(ACTION_TOAST_MIN_MS);
    expect(withActionMinimum({ action, duration: 2000 })?.duration).toBe(6000);
    expect(withActionMinimum({ action, duration: 10000 })?.duration).toBe(10000);
  });

  it("leaves plain toasts at Sonner's default", () => {
    expect(withActionMinimum({ description: "Saved" })?.duration).toBeUndefined();
    expect(withActionMinimum(undefined)).toBeUndefined();
  });

  it("applies the minimum through every toast type", async () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast.success("Reserved! Only you know 🤫", {
        duration: 1000,
        action: { label: "Undo", onClick: () => {} },
      });
    });
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText("Reserved! Only you know 🤫")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
