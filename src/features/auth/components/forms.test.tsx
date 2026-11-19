import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signUp = vi.fn();
const logIn = vi.fn();

vi.mock("../actions", () => ({
  signUp: (...args: unknown[]) => signUp(...args),
  logIn: (...args: unknown[]) => logIn(...args),
  logInWithGoogle: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  resendConfirmation: vi.fn(),
}));

const { SignUpForm } = await import("./sign-up-form");
const { LogInForm } = await import("./log-in-form");

beforeEach(() => {
  signUp.mockReset();
  logIn.mockReset();
});

describe("SignUpForm", () => {
  it("story: Google first, then name, email and password with visible labels", () => {
    render(<SignUpForm />);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apple/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("What should we call you?")).toHaveAttribute(
      "autocomplete",
      "given-name",
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByRole("button", { name: "Create my account" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("consent: under Google and under Create my account, with links, and no checkbox", () => {
    render(<SignUpForm />);
    const notes = screen.getAllByText(/By creating an account, you agree to our/);
    expect(notes).toHaveLength(2);
    // Each note follows the button it's about.
    const google = screen.getByRole("button", { name: "Continue with Google" });
    const create = screen.getByRole("button", { name: "Create my account" });
    expect(google.compareDocumentPosition(notes[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(create.compareDocumentPosition(notes[1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const note of notes) {
      expect(note).toHaveTextContent("By creating an account, you agree to our Terms and Privacy Policy.");
      expect(within(note).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
      expect(within(note).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    }
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("ticks the 8-character check live, and says so to screen readers", async () => {
    render(<SignUpForm />);
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAccessibleDescription("Needs: 8 characters or more");

    await userEvent.type(password, "1234567");
    expect(password).toHaveAccessibleDescription("Needs: 8 characters or more");
    await userEvent.type(password, "8");
    expect(password).toHaveAccessibleDescription("Done: 8 characters or more");
  });

  it("shows and hides the password with a labelled toggle", async () => {
    render(<SignUpForm />);
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Hide password", pressed: true }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("shows errors from the server as text linked to each field, keeping what was typed", async () => {
    signUp.mockResolvedValue({
      fieldErrors: { email: "That email doesn't look right." },
      formError: "Too many tries for now. Please wait a minute and try again.",
      values: { firstName: "Sara", email: "sara@" },
    });
    render(<SignUpForm />);
    await userEvent.type(screen.getByLabelText("What should we call you?"), "Sara");
    await userEvent.type(screen.getByLabelText("Email"), "sara@");
    await userEvent.click(screen.getByRole("button", { name: "Create my account" }));

    const email = await screen.findByLabelText("Email");
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    expect(email).toHaveAccessibleDescription("Error: That email doesn't look right.");
    expect(screen.getByRole("alert")).toHaveTextContent("Too many tries");
    expect(screen.getByLabelText("What should we call you?")).toHaveValue("Sara");
    expect(signUp).toHaveBeenCalledOnce();
  });
});

describe("LogInForm", () => {
  it("Google on log in can create an account, so it carries the consent too", () => {
    render(<LogInForm />);
    const note = screen.getByText(/New here\? Continuing with Google creates an account/);
    expect(note).toHaveTextContent(
      "New here? Continuing with Google creates an account, and you agree to our Terms and Privacy Policy.",
    );
    expect(within(note).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(within(note).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });

  it("story: email, password with a Forgot password link, and a way to sign up", () => {
    render(<LogInForm />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(screen.getByRole("link", { name: "Create a free account" })).toHaveAttribute(
      "href",
      "/sign-up",
    );
    // No live length check when logging in.
    expect(screen.queryByText(/8 characters or more/)).not.toBeInTheDocument();
  });

  it("carries the next page through both forms", () => {
    const { container } = render(<LogInForm next="/people/khalid" />);
    const hidden = container.querySelectorAll('input[type="hidden"][name="next"]');
    expect(hidden).toHaveLength(2);
    for (const input of hidden) expect(input).toHaveValue("/people/khalid");
  });

  it("explains an expired email link", () => {
    render(<LogInForm error="link" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That link has expired or was already used.",
    );
  });

  it("shows a wrong-password message from the server", async () => {
    logIn.mockResolvedValue({
      formError: "That email and password don't match. Try again, or reset your password.",
      values: { email: "sara@test.local" },
    });
    render(<LogInForm />);
    await userEvent.type(screen.getByLabelText("Email"), "sara@test.local");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("don't match");
    expect(screen.getByLabelText("Email")).toHaveValue("sara@test.local");
  });
});
