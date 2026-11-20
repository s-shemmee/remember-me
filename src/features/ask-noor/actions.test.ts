import { FunctionsHttpError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) },
    functions: { invoke },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("server-only", () => ({}));

const { askNoor } = await import("./actions");
const { NOOR_REPLIES } = await import("./schema");

const ask = (question: string) => {
  const fd = new FormData();
  fd.set("question", question);
  return askNoor({ kind: "idle" }, fd);
};

beforeEach(() => {
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("AI_MOCK", "");
  invoke.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("askNoor (Server Action)", () => {
  it("off by default (AI_ENABLED unset): no call at all", async () => {
    vi.stubEnv("AI_ENABLED", "");
    await expect(ask("When do reminders arrive?")).resolves.toEqual({
      kind: "message",
      tone: "info",
      text: NOOR_REPLIES.disabled,
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("checks the question before calling anything", async () => {
    const res = await ask("x".repeat(301));
    expect(res).toMatchObject({ kind: "message", tone: "error" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("an answer from the function is validated and shown with its sources", async () => {
    invoke.mockResolvedValue({
      data: {
        kind: "answer",
        answer: "At 9:00 🕯️",
        sources: [
          { title: "Reminders", heading: "Choose when", url: "/help/reminders#choose-when" },
        ],
      },
      error: null,
    });
    await expect(ask("When do reminders arrive?")).resolves.toEqual({
      kind: "answer",
      question: "When do reminders arrive?",
      answer: "At 9:00 🕯️",
      sources: [{ title: "Reminders", heading: "Choose when", url: "/help/reminders#choose-when" }],
    });
    expect(invoke).toHaveBeenCalledWith("ask-noor", {
      method: "POST",
      body: { question: "When do reminders arrive?" },
    });
  });

  it("a response that doesn't match the schema (e.g. an outside link) is rejected", async () => {
    invoke.mockResolvedValue({
      data: {
        kind: "answer",
        answer: "Go here",
        sources: [{ title: "x", heading: "y", url: "https://evil.example" }],
      },
      error: null,
    });
    await expect(ask("When do reminders arrive?")).resolves.toMatchObject({
      kind: "message",
      tone: "error",
      text: NOOR_REPLIES.failed,
    });
  });

  it("out of scope and the daily limits have Noor's own words", async () => {
    invoke.mockResolvedValueOnce({ data: { kind: "out_of_scope" }, error: null });
    await expect(ask("What's the capital of France?")).resolves.toMatchObject({
      text: NOOR_REPLIES.outOfScope,
    });

    const limited = new FunctionsHttpError(
      new Response(JSON.stringify({ error: "user_limit" }), { status: 429 }),
    );
    invoke.mockResolvedValueOnce({ data: null, error: limited });
    await expect(ask("One more question?")).resolves.toMatchObject({
      tone: "info",
      text: NOOR_REPLIES.userLimit,
    });
  });

  it("AI_MOCK=1 (e2e) answers from the script, without the function", async () => {
    vi.stubEnv("AI_MOCK", "1");
    await expect(ask("When do reminders arrive?")).resolves.toMatchObject({ kind: "answer" });
    await expect(ask("What's the capital of France?")).resolves.toMatchObject({
      text: NOOR_REPLIES.outOfScope,
    });
    expect(invoke).not.toHaveBeenCalled();
  });
});
