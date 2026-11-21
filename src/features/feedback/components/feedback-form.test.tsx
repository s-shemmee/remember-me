import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/help" }));
const sendFeedback = vi.fn();
vi.mock("../actions", () => ({ sendFeedback: (...a: unknown[]) => sendFeedback(...a) }));

const { FeedbackForm } = await import("./feedback-form");

beforeEach(() => vi.clearAllMocks());

describe("Help & feedback → Send feedback", () => {
  it("sends the type, the message and only browser, screen and route", async () => {
    sendFeedback.mockResolvedValue({ ok: true });
    render(<FeedbackForm />);
    await userEvent.click(screen.getByRole("radio", { name: "Something's broken" }));
    await userEvent.type(screen.getByLabelText("Your message"), "The calendar is blank");
    expect(screen.getByText("21/1000 characters")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Include page and device info" })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const sent = sendFeedback.mock.calls[0]![0];
    expect(sent).toMatchObject({ type: "broken", message: "The calendar is blank" });
    expect(Object.keys(sent.meta).sort()).toEqual(["browser", "route", "screen"]);
    expect(sent.meta.route).toBe("/help");
    // The thank-you, with "Send another".
    // Focus moves on the next frame: wait for it.
    const thanks = await screen.findByRole("heading", { name: /Thank you/ });
    await waitFor(() => expect(thanks).toHaveFocus());
    await userEvent.click(screen.getByRole("button", { name: "Send another" }));
    expect(screen.getByLabelText("Your message")).toHaveValue("");
  });

  it("with the switch off, no info at all", async () => {
    sendFeedback.mockResolvedValue({ ok: true });
    render(<FeedbackForm />);
    await userEvent.click(screen.getByRole("radio", { name: "An idea" }));
    await userEvent.type(screen.getByLabelText("Your message"), "Dark calendar");
    await userEvent.click(screen.getByRole("switch", { name: "Include page and device info" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(sendFeedback).toHaveBeenCalledWith({
      type: "idea",
      message: "Dark calendar",
      meta: null,
    });
  });

  it("asks for a type and a message first, and shows the server's limit message", async () => {
    render(<FeedbackForm />);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText("Pick what it's about.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Something else" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByLabelText("Your message")).toHaveAccessibleDescription(/Write a few words/);
    expect(sendFeedback).not.toHaveBeenCalled();

    sendFeedback.mockResolvedValue({
      ok: false,
      message: "That's 5 messages in a day, thank you.",
    });
    await userEvent.type(screen.getByLabelText("Your message"), "Hi");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That's 5 messages in a day");
  });
});
