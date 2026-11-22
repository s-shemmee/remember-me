import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const askNoor = vi.fn();
vi.mock("@/features/ask-noor/actions", () => ({ askNoor: (...a: unknown[]) => askNoor(...a) }));
const newGiftIdeas = vi.fn();
const addGiftIdeaToPlan = vi.fn();
vi.mock("@/features/gift-ideas/actions", () => ({
  newGiftIdeas: (a: unknown) => newGiftIdeas(a),
  addGiftIdeaToPlan: (a: unknown) => addGiftIdeaToPlan(a),
  savedGiftIdeas: vi.fn(),
}));
const draftNoorMessages = vi.fn();
const saveMessageInPlan = vi.fn();
vi.mock("@/features/messages/actions", () => ({
  draftNoorMessages: (a: unknown) => draftNoorMessages(a),
  saveMessageInPlan: (a: unknown) => saveMessageInPlan(a),
  messageContext: vi.fn(),
}));

const { NoorChatProvider } = await import("./chat-context");
const { AskNoorButton, AskNoorChatBox, PersonChatButtons } = await import("./launchers");

const ON = { enabled: true, gifts: true, messages: true };
const SARA = {
  personId: "00000000-0000-4000-8000-000000000001",
  name: "Sara",
  occasionId: "00000000-0000-4000-8000-000000000002",
  occursOn: "2027-01-01",
};
const log = () => screen.getByRole("log", { name: "Conversation with Noor" });

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe("Noor's chat", () => {
  it("off: no launchers at all", () => {
    render(
      <NoorChatProvider flags={{ enabled: false, gifts: true, messages: true }}>
        <AskNoorButton />
        <PersonChatButtons person={SARA} />
      </NoorChatProvider>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("person actions follow their existing feature flags", () => {
    render(
      <NoorChatProvider flags={{ enabled: true, gifts: true, messages: false }}>
        <PersonChatButtons person={SARA} />
      </NoorChatProvider>,
    );
    expect(screen.getByRole("button", { name: "Gift ideas" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Write a message" })).toBeNull();
  });

  it("Home: Ask Noor opens the panel; a help chip gets an answer with its source", async () => {
    askNoor.mockResolvedValue({
      kind: "answer",
      question: "How do reminders work?",
      answer: "Reminders arrive at 9:00 in your time zone.",
      sources: [{ url: "/help/reminders", title: "Reminders", heading: "Reminders" }],
    });
    render(
      <NoorChatProvider flags={ON}>
        <AskNoorButton />
      </NoorChatProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask Noor" }));
    const panel = await screen.findByRole("dialog", { name: "Noor" });
    expect(panel).toHaveAccessibleDescription("Answers from Remember Me help · usually in seconds");
    expect(log()).toHaveAttribute("aria-live", "polite");
    expect(within(panel).getByText("Not saved. Closing clears the chat.")).toBeVisible();
    await userEvent.click(within(panel).getByRole("button", { name: "How do reminders work?" }));
    expect(
      await within(log()).findByText("Reminders arrive at 9:00 in your time zone."),
    ).toBeVisible();
    expect(within(log()).getByRole("link", { name: "From: Reminders →" })).toHaveAttribute(
      "href",
      "/help/reminders",
    );
    const sent = askNoor.mock.calls[0]![1] as FormData;
    expect(sent.get("question")).toBe("How do reminders work?");
  });

  it("typing a question; off-topic gets Noor's fixed reply; 300 max with a count", async () => {
    askNoor.mockResolvedValue({
      kind: "message",
      question: "x",
      tone: "info",
      text: "I can only help with Remember Me 🕯️ For anything else, write to contact@shemme.codes.",
    });
    render(
      <NoorChatProvider flags={ON}>
        <AskNoorButton />
      </NoorChatProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask Noor" }));
    const input = await screen.findByLabelText("Ask Noor");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("maxlength", "300");
    await userEvent.type(input, "Write me a poem{Enter}");
    expect(await within(log()).findByText(/I can only help with Remember Me/)).toBeVisible();
    expect(within(log()).getByRole("link", { name: "contact@shemme.codes" })).toBeVisible();
    expect(screen.getByText("0/300")).toBeInTheDocument();
  });

  it("a person: gift ideas ask the budget, then ideas with Add to plan and Copy", async () => {
    newGiftIdeas.mockResolvedValue({
      kind: "ideas",
      ideas: [
        { title: "Lemon cake class", why: "She loves lemon cake." },
        { title: "Candle set", why: "Candles are her thing." },
        { title: "Poetry book", why: "Poetry on Sundays." },
      ],
      budget: "small",
      createdAt: "2026-11-21T10:00:00Z",
    });
    addGiftIdeaToPlan.mockResolvedValue({ ok: true, plan: {} });
    render(
      <NoorChatProvider flags={ON}>
        <PersonChatButtons person={SARA} />
      </NoorChatProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Gift ideas" }));
    expect(await within(log()).findByText(/What kind of budget\?/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Small" }));
    expect(newGiftIdeas).toHaveBeenCalledWith({ personId: SARA.personId, budget: "small" });
    expect(await within(log()).findByText("Lemon cake class")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Add to plan: Lemon cake class" }));
    expect(addGiftIdeaToPlan).toHaveBeenCalledWith({
      occasionId: SARA.occasionId,
      occursOn: SARA.occursOn,
      title: "Lemon cake class",
    });
    expect(
      await screen.findByRole("button", { name: "In the plan: Lemon cake class" }),
    ).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Copy: Candle set" }));
    expect(await screen.findByRole("button", { name: "Copied: Candle set" })).toBeVisible();
    expect(refresh).toHaveBeenCalled();
  });

  it("a person: write a message asks tone and language, then 3 drafts to use in the plan", async () => {
    draftNoorMessages.mockResolvedValue({
      kind: "messages",
      messages: ["Happy birthday, Sara!", "Another year of you!", "To lemon cake and you"],
    });
    saveMessageInPlan.mockResolvedValue({ ok: true, plan: {} });
    render(
      <NoorChatProvider flags={ON}>
        <PersonChatButtons person={SARA} />
      </NoorChatProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Write a message" }));
    await userEvent.click(await screen.findByRole("button", { name: "Funny" }));
    await userEvent.click(screen.getByRole("button", { name: "French" }));
    expect(draftNoorMessages).toHaveBeenCalledWith({
      occasionId: SARA.occasionId,
      tone: "funny",
      language: "fr",
      length: "short",
    });
    await userEvent.click(await screen.findByRole("button", { name: "Use in plan: draft 2" }));
    expect(saveMessageInPlan).toHaveBeenCalledWith({
      occasionId: SARA.occasionId,
      occursOn: SARA.occursOn,
      stepId: null,
      text: "Another year of you!",
    });
    expect(await screen.findByRole("button", { name: "In the plan: draft 2" })).toBeDisabled();
  });

  it("Help & feedback: the Ask box opens the chat with the question asked", async () => {
    askNoor.mockResolvedValue({
      kind: "answer",
      question: "q",
      answer: "Invites are links that work once, for 7 days.",
      sources: [],
    });
    render(
      <NoorChatProvider flags={ON}>
        <AskNoorChatBox />
      </NoorChatProvider>,
    );
    await userEvent.type(screen.getByLabelText("Your question"), "How do invites work?");
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await within(log()).findByText("How do invites work?")).toBeVisible();
    expect(await within(log()).findByText(/work once, for 7 days/)).toBeVisible();
  });

  it("Start over clears the thread; Close returns focus to the launcher", async () => {
    askNoor.mockResolvedValue({ kind: "answer", question: "q", answer: "An answer.", sources: [] });
    render(
      <NoorChatProvider flags={ON}>
        <AskNoorButton />
      </NoorChatProvider>,
    );
    const launcher = screen.getByRole("button", { name: "Ask Noor" });
    await userEvent.click(launcher);
    await userEvent.click(await screen.findByRole("button", { name: "How do invites work?" }));
    expect(await within(log()).findByText("An answer.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(within(log()).queryByText("An answer.")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(launcher).toHaveFocus());
  });
});
