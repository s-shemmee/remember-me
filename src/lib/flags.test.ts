import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { noorChatEnabled } = await import("./flags");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Noor chat flag", () => {
  it("is off by default and requires AI_ENABLED", () => {
    vi.stubEnv("NOOR_CHAT_ENABLED", "");
    vi.stubEnv("AI_ENABLED", "true");
    expect(noorChatEnabled()).toBe(false);

    vi.stubEnv("NOOR_CHAT_ENABLED", "true");
    vi.stubEnv("AI_ENABLED", "");
    expect(noorChatEnabled()).toBe(false);
  });

  it("turns on only when both switches are enabled", () => {
    vi.stubEnv("NOOR_CHAT_ENABLED", "true");
    vi.stubEnv("AI_ENABLED", "true");
    expect(noorChatEnabled()).toBe(true);
  });
});
