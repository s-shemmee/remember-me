import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FutureNoteCard } from "./future-note";

const actions = vi.hoisted(() => ({
  sealFutureNote: vi.fn(),
  throwAwayFutureNote: vi.fn(),
  setRemindMyDay: vi.fn(),
}));
vi.mock("../actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

beforeEach(() => vi.clearAllMocks());

describe("a note to future me", () => {
  it("is sealed once saved: no reading, no editing", async () => {
    actions.sealFutureNote.mockResolvedValue({ ok: true, opensOn: "2026-11-22" });
    render(<FutureNoteCard hasBirthday sealed={null} opened={null} today="2026-11-04" />);
    await userEvent.type(
      screen.getByRole("textbox", { name: "Write a note to open on your birthday" }),
      "Dear me, you did it.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Seal it until my birthday" }));
    expect(actions.sealFutureNote).toHaveBeenCalledWith("Dear me, you did it.");
    expect(await screen.findByText(/Sealed until 22 November\. Not even you/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Dear me, you did it.")).not.toBeInTheDocument();
  });

  it("can only be thrown away, after a confirmation", async () => {
    actions.throwAwayFutureNote.mockResolvedValue({ ok: true });
    render(
      <FutureNoteCard
        hasBirthday
        sealed={{ opensOn: "2026-11-22" }}
        opened={null}
        today="2026-11-04"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Throw away and write a new one" }));
    expect(actions.throwAwayFutureNote).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep it" })).toHaveFocus());
    await userEvent.click(screen.getByRole("button", { name: "Throw it away" }));
    expect(actions.throwAwayFutureNote).toHaveBeenCalled();
    expect(
      await screen.findByRole("textbox", { name: "Write a note to open on your birthday" }),
    ).toBeInTheDocument();
  });

  it("opens on the day", () => {
    render(
      <FutureNoteCard
        hasBirthday
        sealed={null}
        opened={{ opensOn: "2026-11-22", body: "Happy birthday, me" }}
        today="2026-11-22"
      />,
    );
    expect(screen.getByText("Happy birthday, me")).toBeInTheDocument();
  });

  it("needs a birthday to know when to open", () => {
    render(<FutureNoteCard hasBirthday={false} sealed={null} opened={null} today="2026-11-04" />);
    expect(screen.getByText(/Add your birthday in your profile/)).toBeInTheDocument();
  });
});
