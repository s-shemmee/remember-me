import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reminderSettingsSchema, testEmailMessage } from "../schema";

const saveReminderSettings = vi.fn();
const sendTestEmail = vi.fn();
vi.mock("../actions", () => ({
  saveReminderSettings: (...a: unknown[]) => saveReminderSettings(...a),
  sendTestEmail: (...a: unknown[]) => sendTestEmail(...a),
}));

const { ReminderSettings } = await import("./reminder-settings");

const renderCard = () =>
  render(
    <ReminderSettings email="maya@example.com" initial={{ offsets: [7, 1, 0], email: true }} />,
  );

beforeEach(() => vi.clearAllMocks());

describe("Settings → Reminders", () => {
  it("shows the five chips (pressed as saved), the email switch and the 9:00 note", () => {
    renderCard();
    const chips = screen.getAllByRole("button", { pressed: true });
    expect(chips.map((c) => c.textContent)).toEqual([
      "7 days before",
      "The day before",
      "The morning of",
    ]);
    expect(
      screen.getByRole("button", { name: "2 weeks before", pressed: false }),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "By email" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "By email" })).toHaveAccessibleDescription(
      /A short email to maya@example.com/,
    );
    expect(
      screen.getByText("Reminders arrive at 9:00 in the morning, your time."),
    ).toBeInTheDocument();
  });

  it("saves as you go and says so", async () => {
    saveReminderSettings.mockResolvedValue({ ok: true });
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "2 weeks before" }));
    expect(saveReminderSettings).toHaveBeenCalledWith({ offsets: [14, 7, 1, 0], email: true });
    expect(await screen.findByText("Saved ✓")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "By email" }));
    expect(saveReminderSettings).toHaveBeenLastCalledWith({ offsets: [14, 7, 1, 0], email: false });
  });

  it("a failed save puts things back and says what happened", async () => {
    saveReminderSettings.mockResolvedValue({
      ok: false,
      message: "That didn't save. Please try again.",
    });
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "7 days before" }));
    expect(await screen.findByText("That didn't save. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7 days before" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("no days picked: says there won't be reminders", async () => {
    saveReminderSettings.mockResolvedValue({ ok: true });
    render(<ReminderSettings email="c@example.com" initial={{ offsets: [0], email: true }} />);
    await userEvent.click(screen.getByRole("button", { name: "The morning of" }));
    expect(screen.getByText(/No days picked, so no reminders/)).toBeInTheDocument();
  });

  it("Send me a test email: the result is announced", async () => {
    sendTestEmail.mockResolvedValue({
      ok: true,
      message: "Sent to c•••@example.com. It can take a minute to arrive.",
    });
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Send me a test email" }));
    await waitFor(() =>
      expect(
        screen.getByText("Sent to c•••@example.com. It can take a minute to arrive."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/Sent to/)).toHaveAttribute("aria-live", "polite");
  });
});

describe("settings rules", () => {
  it("only the five offsets, each once, longest first", () => {
    expect(reminderSettingsSchema.parse({ offsets: [0, 14, 7], email: true })).toEqual({
      offsets: [14, 7, 0],
      email: true,
    });
    expect(reminderSettingsSchema.safeParse({ offsets: [2], email: true }).success).toBe(false);
    expect(reminderSettingsSchema.safeParse({ offsets: [7, 7], email: true }).success).toBe(false);
    expect(reminderSettingsSchema.safeParse({ offsets: [7], email: "yes" }).success).toBe(false);
  });

  it("test email messages", () => {
    expect(testEmailMessage({ ok: true, to: "s•••@gmail.com" })).toBe(
      "Sent to s•••@gmail.com. It can take a minute to arrive.",
    );
    expect(testEmailMessage({ ok: false, code: "too_many" })).toMatch(/3 test emails this hour/);
    expect(testEmailMessage({ ok: false, code: "send_failed" })).toMatch(/couldn't send it/);
  });
});
