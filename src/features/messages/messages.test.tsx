import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OCCASION = "00000000-0000-4000-8000-000000000001";
const PERSON = "00000000-0000-4000-8000-000000000002";
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
vi.mock("next/navigation", () => ({ redirect: vi.fn(), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("server-only", () => ({}));

const { draftNoorMessages } = await import("./actions");
const { MESSAGE_REPLIES, MOCK_MESSAGES } = await import("./schema");

const birthday = { kind: "birthday", day: 14, month: 3, year: 1996, recurring: true };
const DRAFTS = ["Happy birthday, Khalid!", "Thirty looks good on you ☕", "To many more ⚽"];
const ask = (extra: object = {}) =>
  draftNoorMessages({
    occasionId: OCCASION,
    tone: "warm",
    language: "en",
    length: "short",
    ...extra,
  });

beforeEach(() => {
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("AI_MESSAGES_ENABLED", "true");
  vi.stubEnv("AI_MOCK", "");
  invoke.mockReset();
  rows = {
    occasions: { person_id: PERSON, people: { in_memory: false, occasions: [birthday] } },
    profiles: { timezone: "Africa/Casablanca" },
  };
});
afterEach(() => vi.unstubAllEnvs());

describe("draftNoorMessages (Server Action)", () => {
  it("off unless both AI_ENABLED and AI_MESSAGES_ENABLED: no call", async () => {
    vi.stubEnv("AI_ENABLED", "");
    await expect(ask()).resolves.toMatchObject({ text: MESSAGE_REPLIES.disabled });
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_MESSAGES_ENABLED", "");
    await expect(ask()).resolves.toMatchObject({ text: MESSAGE_REPLIES.disabled });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("validates the choices and the mention (200 max) first", async () => {
    await expect(ask({ tone: "angry" })).resolves.toMatchObject({ tone: "error" });
    await expect(ask({ language: "de" })).resolves.toMatchObject({ tone: "error" });
    await expect(ask({ mention: "x".repeat(201) })).resolves.toMatchObject({ tone: "error" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("not your day, someone In memory, or a Remembrance day only: no call", async () => {
    rows.occasions = null;
    await expect(ask()).resolves.toMatchObject({ text: MESSAGE_REPLIES.notForThisDay });
    rows.occasions = { person_id: PERSON, people: { in_memory: true, occasions: [birthday] } };
    await expect(ask()).resolves.toMatchObject({ text: MESSAGE_REPLIES.notForThisDay });
    rows.occasions = {
      person_id: PERSON,
      people: { in_memory: false, occasions: [{ ...birthday, kind: "remembrance" }] },
    };
    await expect(ask()).resolves.toMatchObject({ text: MESSAGE_REPLIES.notForThisDay });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("asks the function with the person and the choices only", async () => {
    invoke.mockResolvedValue({ data: { kind: "messages", messages: DRAFTS }, error: null });
    await expect(ask({ language: "darija", mention: "  our trip  " })).resolves.toEqual({
      kind: "messages",
      messages: DRAFTS,
    });
    expect(invoke).toHaveBeenCalledWith("noor-messages", {
      method: "POST",
      body: {
        personId: PERSON,
        tone: "warm",
        language: "darija",
        length: "short",
        mention: "our trip",
        includeAge: false,
        things: null,
      },
    });
  });

  it("the daily limit (10), a refusal, and a reply that breaks the schema", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: new FunctionsHttpError(
        new Response(JSON.stringify({ error: "user_limit" }), { status: 429 }),
      ),
    });
    await expect(ask()).resolves.toMatchObject({ text: MESSAGE_REPLIES.userLimit });
    invoke.mockResolvedValueOnce({ data: { kind: "refused" }, error: null });
    await expect(ask()).resolves.toMatchObject({ text: MESSAGE_REPLIES.refused });
    invoke.mockResolvedValueOnce({
      data: { kind: "messages", messages: ["Mail me at a@b.co", "ab", "cd"] },
      error: null,
    });
    await expect(ask()).resolves.toMatchObject({ tone: "error" });
  });

  it("AI_MOCK=1: the fixtures for that language, no call", async () => {
    vi.stubEnv("AI_MOCK", "1");
    await expect(ask({ language: "fr" })).resolves.toEqual({
      kind: "messages",
      messages: MOCK_MESSAGES.fr,
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("the fixtures pass the same checks as real drafts", async () => {
    const { draftsSchema, hasArabicScript } = await import("@/ai/messages/drafts");
    for (const [lang, drafts] of Object.entries(MOCK_MESSAGES)) {
      expect(draftsSchema.safeParse(drafts).success, lang).toBe(true);
      expect(hasArabicScript(drafts.join(" ")), lang).toBe(lang === "ar");
    }
  });
});

// The sheet ------------------------------------------------------------------------------------
const draft = vi.fn();
const save = vi.fn();
const context = vi.fn();
vi.doMock("./actions", () => ({
  draftNoorMessages: draft,
  saveMessageInPlan: save,
  messageContext: context,
}));

describe("WriteMessageButton", () => {
  it("choices, 3 editable drafts, Copy, and Use in plan with the edited text", async () => {
    vi.resetModules();
    const { WriteMessageButton } = await import("./components/message-sheet");
    draft.mockResolvedValue({ kind: "messages", messages: DRAFTS });
    context.mockResolvedValue({
      littleThings: [
        { emoji: "⚽", text: "Loves football" },
        { emoji: "☕", text: "Black coffee" },
      ],
      age: 30,
    });
    save.mockResolvedValue({
      ok: true,
      plan: { id: "p", occasionId: OCCASION, occursOn: "2027-03-14", note: "", steps: [] },
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(
      <WriteMessageButton
        target={{ name: "Khalid", occasionId: OCCASION, occursOn: "2027-03-14", stepId: null }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Write a message" }));
    await userEvent.click(await screen.findByRole("radio", { name: "Funny" }));
    await userEvent.click(screen.getByRole("radio", { name: "Darija (Latin letters)" }));
    await userEvent.click(screen.getByRole("radio", { name: "Medium" }));
    await userEvent.type(screen.getByLabelText("Something to mention (optional)"), "our trip");
    // Their little things, all on; one turned off. The age is off until allowed.
    const football = await screen.findByRole("button", { name: /Loves football/ });
    expect(football).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(football);
    const age = screen.getByRole("switch", { name: "Mention that they turn 30" });
    expect(age).not.toBeChecked();
    await userEvent.click(age);
    await userEvent.click(screen.getByRole("button", { name: "Write with Noor" }));
    expect(draft).toHaveBeenCalledWith({
      occasionId: OCCASION,
      tone: "funny",
      language: "darija",
      length: "medium",
      mention: "our trip",
      // Only the little thing still chosen, and the age they allowed.
      includeAge: true,
      things: ["Black coffee"],
    });

    const second = await screen.findByLabelText("Draft 2");
    expect(second).toHaveValue(DRAFTS[1]);
    expect(screen.getByRole("button", { name: "New drafts" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Copy: draft 1" }));
    expect(writeText).toHaveBeenCalledWith(DRAFTS[0]);
    expect(screen.getByRole("button", { name: "Copied: draft 1" })).toBeVisible();

    await userEvent.clear(second);
    await userEvent.type(second, "Edited by me");
    await userEvent.click(screen.getByRole("button", { name: "Use in plan: draft 2" }));
    expect(save).toHaveBeenCalledWith({
      occasionId: OCCASION,
      occursOn: "2027-03-14",
      stepId: null,
      text: "Edited by me",
    });
  }, 20_000);
});
