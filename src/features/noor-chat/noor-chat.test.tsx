import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const askNoor = vi.fn();
vi.mock("@/features/ask-noor/actions", () => ({ askNoor: (...a: unknown[]) => askNoor(...a) }));

const { NoorChatProvider } = await import("./chat-context");
const { AskNoorButton, AskNoorChatBox } = await import("./launchers");

const ON = { enabled: true };
const log = () => screen.getByRole("log", { name: "Conversation with Noor" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Noor's chat", () => {
  it("off: no launchers at all", () => {
    render(
      <NoorChatProvider flags={{ enabled: false }}>
        <AskNoorButton />
      </NoorChatProvider>,
    );
    expect(screen.queryByRole("button")).toBeNull();
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
    await userEvent.type(
      screen.getByLabelText("Ask me anything about Remember Me."),
      "How do invites work?",
    );
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
