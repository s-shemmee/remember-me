import { FunctionsHttpError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PERSON = "00000000-0000-4000-8000-000000000001";
const invoke = vi.fn();
let rows: Record<string, unknown> = {};

/** A tiny stand-in for the query builder: every filter chains, maybeSingle answers per table. */
const from = (table: string) => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
  };
  return chain;
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) },
    functions: { invoke },
    from,
  }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("server-only", () => ({}));

const { newGiftIdeas, savedGiftIdeas } = await import("./actions");
const { GIFT_REPLIES, MOCK_IDEAS } = await import("./schema");

const birthday = { kind: "birthday", day: 14, month: 3, year: null, recurring: true };
const remembrance = { kind: "remembrance", day: 14, month: 3, year: null, recurring: true };
const IDEAS = [
  { title: "A mint tea set", why: "They love mint tea." },
  { title: "A hiking day", why: "Being outdoors is their thing." },
  { title: "A jazz record", why: "Old jazz on Sunday mornings." },
];

beforeEach(() => {
  vi.stubEnv("AI_GIFT_IDEAS_ENABLED", "true");
  vi.stubEnv("AI_MOCK", "");
  invoke.mockReset();
  rows = {
    people: { in_memory: false, occasions: [birthday] },
    profiles: { timezone: "Africa/Casablanca" },
  };
});
afterEach(() => vi.unstubAllEnvs());

const httpError = (status: number, error: string) =>
  new FunctionsHttpError(new Response(JSON.stringify({ error }), { status }));

describe("newGiftIdeas (Server Action)", () => {
  it("off by default, on its own switch: no call at all", async () => {
    vi.stubEnv("AI_GIFT_IDEAS_ENABLED", "");
    vi.stubEnv("AI_ENABLED", "true"); // Ask Noor on doesn't turn gift ideas on
    await expect(newGiftIdeas({ personId: PERSON })).resolves.toEqual({
      kind: "message",
      tone: "info",
      text: GIFT_REPLIES.disabled,
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("validates the input first", async () => {
    await expect(newGiftIdeas({ personId: "nope" })).resolves.toMatchObject({ tone: "error" });
    await expect(newGiftIdeas({ personId: PERSON, budget: "huge" })).resolves.toMatchObject({
      tone: "error",
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("not your person (RLS returns nothing): no call", async () => {
    rows.people = null;
    await expect(newGiftIdeas({ personId: PERSON })).resolves.toMatchObject({
      text: GIFT_REPLIES.notForThisDay,
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("hidden for gentle days: only a Remembrance day coming, no call", async () => {
    rows.people = { in_memory: false, occasions: [remembrance] };
    await expect(newGiftIdeas({ personId: PERSON })).resolves.toMatchObject({
      text: GIFT_REPLIES.notForThisDay,
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("hidden for someone In memory, no call", async () => {
    rows.people = { in_memory: true, occasions: [birthday] };
    await expect(newGiftIdeas({ personId: PERSON })).resolves.toMatchObject({
      text: GIFT_REPLIES.notForThisDay,
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("asks the function with the person and the budget word only", async () => {
    const createdAt = "2026-11-20T10:00:00.000Z";
    invoke.mockResolvedValue({
      data: { kind: "ideas", ideas: IDEAS, budget: "treat", createdAt },
      error: null,
    });
    await expect(newGiftIdeas({ personId: PERSON, budget: "treat" })).resolves.toEqual({
      kind: "ideas",
      ideas: IDEAS,
      budget: "treat",
      createdAt,
    });
    expect(invoke).toHaveBeenCalledWith("gift-ideas", {
      method: "POST",
      body: { personId: PERSON, budget: "treat" },
    });
  });

  it("the daily limit (5) gets Noor's kind message", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(429, "user_limit") });
    await expect(newGiftIdeas({ personId: PERSON })).resolves.toEqual({
      kind: "message",
      tone: "info",
      text: GIFT_REPLIES.userLimit,
    });
  });

  it("the shared global cap too", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(429, "global_limit") });
    await expect(newGiftIdeas({ personId: PERSON })).resolves.toMatchObject({
      text: GIFT_REPLIES.globalLimit,
    });
  });

  it("no usable ideas after the retry and fallback: a friendly message", async () => {
    invoke.mockResolvedValue({ data: { kind: "unavailable" }, error: null });
    await expect(newGiftIdeas({ personId: PERSON })).resolves.toMatchObject({
      text: GIFT_REPLIES.unavailable,
    });
  });

  it("a reply that breaks the schema (a price) is rejected here too", async () => {
    invoke.mockResolvedValue({
      data: {
        kind: "ideas",
        ideas: [{ title: "A $40 mug", why: "Tea." }, ...IDEAS.slice(1)],
        budget: null,
        createdAt: "2026-11-20T10:00:00.000Z",
      },
      error: null,
    });
    await expect(newGiftIdeas({ personId: PERSON })).resolves.toMatchObject({ tone: "error" });
  });

  it("AI_MOCK=1: scripted ideas, no call", async () => {
    vi.stubEnv("AI_MOCK", "1");
    await expect(newGiftIdeas({ personId: PERSON })).resolves.toMatchObject({
      kind: "ideas",
      ideas: MOCK_IDEAS,
    });
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("savedGiftIdeas: reopening costs nothing", () => {
  it("reads the saved result, no AI call", async () => {
    rows.gift_idea_results = {
      ideas: IDEAS,
      budget: "small",
      created_at: "2026-11-20T10:00:00+00:00",
    };
    await expect(savedGiftIdeas({ personId: PERSON })).resolves.toMatchObject({
      kind: "ideas",
      ideas: IDEAS,
      budget: "small",
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("nothing saved yet", async () => {
    await expect(savedGiftIdeas({ personId: PERSON })).resolves.toBeNull();
  });
});
