import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("keeps our font sizes when a text colour is added", () => {
    expect(cn("text-15", "text-sub")).toBe("text-15 text-sub");
    expect(cn("text-15 text-sub", "text-text")).toBe("text-15 text-text");
  });

  it("lets a later size, radius or shadow override an earlier one", () => {
    expect(cn("text-15", "text-17")).toBe("text-17");
    expect(cn("rounded-pill", "rounded-card")).toBe("rounded-card");
    expect(cn("shadow-card", "shadow-none")).toBe("shadow-none");
    expect(cn("shadow-card", "shadow-popover")).toBe("shadow-popover");
  });

  it("treats our colour tokens as colours", () => {
    expect(cn("bg-card", "bg-peach")).toBe("bg-peach");
    expect(cn("text-sub", "text-accent-text")).toBe("text-accent-text");
  });

  it("keeps font families apart from weights", () => {
    expect(cn("font-hand", "font-bold")).toBe("font-hand font-bold");
  });
});
