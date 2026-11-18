import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_DB_PASSWORD } from "@/test/fake-values";

// --- mocks ------------------------------------------------------------------
class Redirect extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

const auth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getClaims: vi.fn(),
  updateUser: vi.fn(),
  resend: vi.fn(),
  signOut: vi.fn(),
};
const cookieJar = new Map<string, string>();
const cookieSet = vi.fn((name: string, value: string, _options?: Record<string, unknown>) =>
  cookieJar.set(name, value),
);
let profileOnboardedAt: string | null = "2026-11-07T10:00:00Z";
let requestHeaders = new Headers({ origin: "http://localhost:3000" });

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: cookieSet,
  }),
}));
// Sentry: what would be sent, to check it never carries an email or password.
const sentry = vi.hoisted(() => {
  const scope = {
    setLevel: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    setFingerprint: vi.fn(),
  };
  return {
    scope,
    captureMessage: vi.fn(),
    withScope: vi.fn((fn: (s: typeof scope) => void) => fn(scope)),
  };
});
vi.mock("@sentry/nextjs", () => ({
  captureMessage: sentry.captureMessage,
  withScope: sentry.withScope,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth,
    // profiles.onboarded_at lookup after log in
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { onboarded_at: profileOnboardedAt }, error: null }),
        }),
      }),
    }),
  }),
}));

const actions = await import("./actions");

// --- helpers ----------------------------------------------------------------
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

/** Runs an action and returns either its state or the redirect target. */
async function run<T>(promise: Promise<T>): Promise<{ state?: T; redirect?: string }> {
  try {
    return { state: await promise };
  } catch (error) {
    if (error instanceof Redirect) return { redirect: error.url };
    throw error;
  }
}

const authError = (code: string, status = 400) => ({ code, status, message: code });
const PASSWORD = FAKE_DB_PASSWORD; // any 8+ character fake

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset();
  sentry.captureMessage.mockClear();
  for (const fn of Object.values(sentry.scope)) fn.mockClear();
  cookieJar.clear();
  cookieSet.mockClear();
  requestHeaders = new Headers({ origin: "http://localhost:3000" });
});

// --- sign up ------------------------------------------------------------------
describe("signUp", () => {
  const valid = { firstName: " Sara ", email: "sara@test.local", password: PASSWORD };

  it("shows field errors and keeps name and email, never the password", async () => {
    const { state } = await run(
      actions.signUp({}, form({ firstName: "", email: "nope", password: "short" })),
    );
    expect(state?.fieldErrors).toEqual({
      firstName: "What should we call you?",
      email: "That email doesn't look right.",
      password: "Use 8 characters or more.",
    });
    expect(state?.values).toEqual({ firstName: "", email: "nope" });
    expect(JSON.stringify(state)).not.toContain("short");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("signs up with the trimmed first name and a confirm link back to this site", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null });
    const { redirect } = await run(actions.signUp({}, form(valid)));

    expect(auth.signUp).toHaveBeenCalledWith({
      email: "sara@test.local",
      password: PASSWORD,
      options: {
        data: { first_name: "Sara" },
        emailRedirectTo: "http://localhost:3000/auth/confirm",
      },
    });
    expect(redirect).toBe("/check-email");
    expect(cookieJar.get("rm-pending-email")).toBe("sara@test.local");
    expect(cookieSet.mock.calls[0]?.[2]).toMatchObject({ httpOnly: true, sameSite: "lax" });
  });

  it("treats an existing account exactly like a new one (no account enumeration)", async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: authError("user_already_exists", 422),
    });
    expect((await run(actions.signUp({}, form(valid)))).redirect).toBe("/check-email");
  });

  it("explains rate limits and weak passwords", async () => {
    auth.signUp.mockResolvedValue({
      data: {},
      error: authError("over_email_send_rate_limit", 429),
    });
    expect((await run(actions.signUp({}, form(valid)))).state?.formError).toMatch(/Too many tries/);

    auth.signUp.mockResolvedValue({ data: {}, error: authError("weak_password", 422) });
    expect((await run(actions.signUp({}, form(valid)))).state?.fieldErrors?.password).toMatch(
      /too easy/,
    );
  });

  it("uses the forwarded host when there is no Origin header", async () => {
    requestHeaders = new Headers({
      "x-forwarded-host": "preview.vercel.app",
      "x-forwarded-proto": "https",
    });
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await run(actions.signUp({}, form(valid)));
    expect(auth.signUp.mock.calls[0]?.[0].options.emailRedirectTo).toBe(
      "https://preview.vercel.app/auth/confirm",
    );
  });
});

// --- log in -------------------------------------------------------------------
describe("logIn", () => {
  it("sends people who haven't finished onboarding straight to /onboarding", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
    profileOnboardedAt = null;
    const { redirect } = await run(
      actions.logIn({}, form({ email: "sara@test.local", password: PASSWORD, next: "/people" })),
    );
    expect(redirect).toBe("/onboarding");
    profileOnboardedAt = "2026-11-07T10:00:00Z";
  });

  const valid = { email: "sara@test.local", password: PASSWORD };

  it("goes home, or to a same-site next page, after logging in", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
    expect((await run(actions.logIn({}, form(valid)))).redirect).toBe("/home");
    expect(
      (await run(actions.logIn({}, form({ ...valid, next: "/people/khalid" })))).redirect,
    ).toBe("/people/khalid");
    expect(
      (await run(actions.logIn({}, form({ ...valid, next: "https://evil.example" })))).redirect,
    ).toBe("/home");
  });

  it("gives one message for a wrong email or password, keeping only the email", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: authError("invalid_credentials"),
    });
    const { state } = await run(actions.logIn({}, form(valid)));
    expect(state?.formError).toBe(
      "That email and password don't match. Try again, or reset your password.",
    );
    expect(state?.values).toEqual({ email: "sara@test.local" });
  });

  it("asks unconfirmed people to confirm their email", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: authError("email_not_confirmed"),
    });
    expect((await run(actions.logIn({}, form(valid)))).state?.formError).toMatch(
      /confirm your email/,
    );
  });

  it("validates before calling Supabase", async () => {
    const { state } = await run(actions.logIn({}, form({ email: "", password: "" })));
    expect(state?.fieldErrors).toEqual({
      email: "Please enter your email.",
      password: "Please enter your password.",
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("logInWithGoogle", () => {
  it("returns to /auth/callback with the safe next page, then goes to Google", async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.test/o" },
      error: null,
    });
    const { redirect } = await run(actions.logInWithGoogle(form({ next: "/settings" })));

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost:3000/auth/callback?next=%2Fsettings" },
    });
    expect(redirect).toBe("https://accounts.google.test/o");
  });

  it("goes back to log in with a message if Google can't start", async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: authError("unexpected_failure", 500),
    });
    expect((await run(actions.logInWithGoogle(form({})))).redirect).toBe("/log-in?error=google");
  });
});

// --- passwords ------------------------------------------------------------------
describe("requestPasswordReset", () => {
  it("answers the same whether or not the account exists", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const found = await run(actions.requestPasswordReset({}, form({ email: "sara@test.local" })));

    auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: authError("user_not_found", 404),
    });
    const missing = await run(
      actions.requestPasswordReset({}, form({ email: "nobody@test.local" })),
    );

    expect(found.state).toEqual(missing.state);
    expect(found.state?.notice).toMatch(/If there's an account for that email/);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("sara@test.local", {
      redirectTo: "http://localhost:3000/auth/confirm",
    });
  });
});

describe("updatePassword", () => {
  it("says the link expired when there is no recovery session", async () => {
    auth.getClaims.mockResolvedValue({ data: null, error: null });
    const { state } = await run(actions.updatePassword({}, form({ password: PASSWORD })));
    expect(state?.formError).toMatch(/expired/);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("refuses the current password and saves a new one", async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });
    auth.updateUser.mockResolvedValueOnce({ data: {}, error: authError("same_password", 422) });
    expect(
      (await run(actions.updatePassword({}, form({ password: PASSWORD })))).state?.fieldErrors
        ?.password,
    ).toMatch(/current password/);

    auth.updateUser.mockResolvedValueOnce({ data: {}, error: null });
    expect((await run(actions.updatePassword({}, form({ password: PASSWORD })))).redirect).toBe(
      "/home",
    );
  });
});

describe("resendConfirmation", () => {
  it("needs the pending email from sign-up", async () => {
    const { state } = await run(actions.resendConfirmation({}, form({})));
    expect(state?.formError).toMatch(/sign up again/);
    expect(auth.resend).not.toHaveBeenCalled();
  });

  it("resends to the email from sign-up", async () => {
    cookieJar.set("rm-pending-email", "sara@test.local");
    auth.resend.mockResolvedValue({ data: {}, error: null });
    const { state } = await run(actions.resendConfirmation({}, form({})));
    expect(auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "sara@test.local",
      options: { emailRedirectTo: "http://localhost:3000/auth/confirm" },
    });
    expect(state?.notice).toMatch(/Sent again/);
  });
});

describe("logOut", () => {
  it("signs out and goes to log in", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    expect((await run(actions.logOut())).redirect).toBe("/log-in");
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
});

// --- auth error reporting -------------------------------------------------------
describe("auth errors", () => {
  const EMAIL = "sara@test.local";
  const signUpForm = () => form({ firstName: "Sara", email: EMAIL, password: PASSWORD });
  /** Everything handed to Sentry, as one string. */
  const sent = () =>
    JSON.stringify([
      sentry.captureMessage.mock.calls,
      sentry.scope.setTags.mock.calls,
      sentry.scope.setContext.mock.calls,
      sentry.scope.setFingerprint.mock.calls,
    ]);
  const NOT_SENT = "We couldn't send your confirmation email. Please try again in a few minutes.";

  it("the built-in sender refusing the address: a clear message, reported without the address", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        code: "email_address_not_authorized",
        status: 400,
        message: `Email address "${EMAIL}" cannot be used as it is not authorized`,
      },
    });
    const { state } = await run(actions.signUp({}, signUpForm()));
    expect(state?.formError).toBe(NOT_SENT);
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(sentry.scope.setTags).toHaveBeenCalledWith({
      auth_action: "sign_up",
      supabase_code: "email_address_not_authorized",
    });
    expect(sentry.scope.setContext).toHaveBeenCalledWith("supabase_auth", { status: 400 });
    expect(sent()).not.toContain(EMAIL);
    expect(sent()).not.toContain(PASSWORD);
    expect(sent()).not.toContain("cannot be used");
  });

  it("'Error sending confirmation email': the same message", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        code: "unexpected_failure",
        status: 500,
        message: "Error sending confirmation email",
      },
    });
    const { state } = await run(actions.signUp({}, signUpForm()));
    expect(state?.formError).toBe(NOT_SENT);
    expect(sentry.scope.setTags).toHaveBeenCalledWith({
      auth_action: "sign_up",
      supabase_code: "unexpected_failure",
    });
  });

  it("resending can fail the same way", async () => {
    cookieJar.set("rm-pending-email", EMAIL);
    auth.resend.mockResolvedValue({
      data: {},
      error: {
        code: "unexpected_failure",
        status: 500,
        message: "Error sending confirmation email",
      },
    });
    const { state } = await run(actions.resendConfirmation({}, form({})));
    expect(state?.formError).toBe(NOT_SENT);
    expect(sent()).not.toContain(EMAIL);
  });

  it("anything unexpected: the generic message, and Sentry gets the code and status only", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "unexpected_failure", status: 500, message: `Database error for ${EMAIL}` },
    });
    const { state } = await run(actions.signUp({}, signUpForm()));
    expect(state?.formError).toBe("Something went wrong on our side. Please try again.");
    expect(sentry.captureMessage).toHaveBeenCalledWith("Auth: sign_up failed (unexpected_failure)");
    expect(sent()).not.toContain(EMAIL);
    expect(sent()).not.toContain(PASSWORD);

    sentry.captureMessage.mockClear();
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: undefined, status: 502, message: "Bad gateway" },
    });
    const login = await run(actions.logIn({}, form({ email: EMAIL, password: PASSWORD })));
    expect(login.state?.formError).toBe("Something went wrong on our side. Please try again.");
    expect(sentry.captureMessage).toHaveBeenCalledWith("Auth: log_in failed (unknown)");
    expect(sentry.scope.setContext).toHaveBeenLastCalledWith("supabase_auth", { status: 502 });
    expect(sent()).not.toContain(EMAIL);
  });

  it("expected answers (wrong password, rate limits, an existing account) aren't reported", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: authError("invalid_credentials"),
    });
    await run(actions.logIn({}, form({ email: EMAIL, password: PASSWORD })));
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: authError("over_request_rate_limit", 429),
    });
    await run(actions.signUp({}, signUpForm()));
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: authError("user_already_exists", 422),
    });
    await run(actions.signUp({}, signUpForm()));
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });
});
