import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = {
  changeEmail: vi.fn(),
  changePassword: vi.fn(),
  logOutEverywhere: vi.fn(),
  deleteAccount: vi.fn(),
};
vi.mock("../actions", () => actions);
const saveTheme = vi.fn();
vi.mock("@/features/profile/actions", () => ({ saveTheme: (...a: unknown[]) => saveTheme(...a) }));

const { AccountCard } = await import("./account-card");
const { AppearanceCard } = await import("./appearance-card");
const { DeleteAccountCard, DownloadDataCard } = await import("./data-card");

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("Settings → Account", () => {
  it("email accounts: change email asks for the current password", async () => {
    actions.changeEmail.mockResolvedValue({
      ok: true,
      message:
        "Almost there. Check new@example.com (and your current inbox) to confirm the change.",
    });
    render(<AccountCard email="c@example.com" mode="password" />);
    await userEvent.type(screen.getByLabelText("New email"), "new@example.com");
    await userEvent.type(screen.getAllByLabelText("Current password")[0]!, "secret-123");
    await userEvent.click(screen.getByRole("button", { name: "Change email" }));
    expect(actions.changeEmail).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "secret-123",
    });
    expect(await screen.findByText(/Check new@example.com/)).toHaveAttribute("aria-live", "polite");
  });

  it("a wrong password shows on the password field", async () => {
    actions.changeEmail.mockResolvedValue({
      ok: false,
      message: "That password isn't right.",
      field: "password",
    });
    render(<AccountCard email="c@example.com" mode="password" />);
    await userEvent.type(screen.getByLabelText("New email"), "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Change email" }));
    expect(await screen.findByText("That password isn't right.")).toBeVisible();
  });

  it("Google-only accounts: no password fields, a note about signing in again", async () => {
    actions.changeEmail.mockResolvedValue({
      ok: false,
      message: "Please log in again to continue.",
    });
    render(<AccountCard email="c@gmail.com" mode="recent-sign-in" />);
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Change password" })).toBeNull();
    expect(screen.getByText(/within 10 minutes of logging in with Google/)).toBeVisible();
    await userEvent.type(screen.getByLabelText("New email"), "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Change email" }));
    expect(actions.changeEmail).toHaveBeenCalledWith({
      email: "new@example.com",
      password: undefined,
    });
    expect(await screen.findByText("Please log in again to continue.")).toBeVisible();
  });

  it("change password and log out of all devices", async () => {
    actions.changePassword.mockResolvedValue({ ok: true, message: "Password changed ✓" });
    render(<AccountCard email="c@example.com" mode="password" />);
    const [, current] = screen.getAllByLabelText("Current password");
    await userEvent.type(current!, "old-pass-1");
    await userEvent.type(screen.getByLabelText("New password"), "new-pass-123");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(actions.changePassword).toHaveBeenCalledWith({
      current: "old-pass-1",
      next: "new-pass-123",
    });
    expect(await screen.findByText("Password changed ✓")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Log out of all devices" }));
    expect(actions.logOutEverywhere).toHaveBeenCalled();
  });
});

describe("Settings → Appearance", () => {
  it("Light, Dark or System: applied at once, kept on this device and saved", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    render(<AppearanceCard saved="light" />);
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("rm-theme")).toBe("dark");
    expect(saveTheme).toHaveBeenCalledWith("dark");
    expect(await screen.findByText("Saved")).toBeVisible();
    await userEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(group).toBeVisible();
  });
});

describe("Settings → Privacy (your data) and Account (delete)", () => {
  it("download is a plain link to the export", () => {
    render(<DownloadDataCard />);
    expect(screen.getByRole("link", { name: "Download my data" })).toHaveAttribute(
      "href",
      "/settings/export",
    );
  });

  it("delete asks to type the email (and the password), and stays disabled until it matches", async () => {
    actions.deleteAccount.mockResolvedValue({
      ok: false,
      message: "That password isn't right.",
      field: "password",
    });
    render(<DeleteAccountCard email="c@example.com" mode="password" />);
    await userEvent.click(screen.getByRole("button", { name: "Delete my account…" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete your account?" });
    const confirm = screen.getByRole("button", { name: "Delete forever" });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Type c@example.com"), "C@Example.com");
    expect(confirm).toBeEnabled();
    await userEvent.type(screen.getByLabelText("Your password"), "wrong");
    await userEvent.click(confirm);
    expect(actions.deleteAccount).toHaveBeenCalledWith({
      email: "C@Example.com",
      password: "wrong",
    });
    expect(await screen.findByText("That password isn't right.")).toBeVisible();
    expect(dialog).toBeVisible();
  });

  it("Google-only: no password, the recent sign-in note, and the server's 'log in again'", async () => {
    actions.deleteAccount.mockResolvedValue({
      ok: false,
      message: "Please log in again to continue.",
    });
    render(<DeleteAccountCard email="c@gmail.com" mode="recent-sign-in" />);
    await userEvent.click(screen.getByRole("button", { name: "Delete my account…" }));
    expect(screen.queryByLabelText("Your password")).toBeNull();
    await userEvent.type(screen.getByLabelText("Type c@gmail.com"), "c@gmail.com");
    await userEvent.click(screen.getByRole("button", { name: "Delete forever" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Please log in again to continue."),
    );
  });

  it("Keep my account closes it and focus goes back", async () => {
    render(<DeleteAccountCard email="c@example.com" mode="password" />);
    const opener = screen.getByRole("button", { name: "Delete my account…" });
    await userEvent.click(opener);
    await userEvent.click(await screen.findByRole("button", { name: "Keep my account" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
