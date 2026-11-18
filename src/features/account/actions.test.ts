import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_DB_PASSWORD } from "@/test/fake-values";

const auth = { getClaims: vi.fn(), updateUser: vi.fn() };
const notices = vi.hoisted(() => ({
  requested: [] as string[],
  afterQueue: [] as (() => unknown)[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    notices.afterQueue.push(fn);
  },
}));
vi.mock("@/lib/site-origin", () => ({ siteOrigin: async () => "http://localhost:3000" }));
vi.mock("@/lib/account-notice", () => ({
  requestAccountNotice: async (email: string) => {
    notices.requested.push(email);
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth }) }));
vi.mock("./reauth", () => ({
  reauthenticate: async () => ({ result: "ok", mode: "password", email: "sara@test.local" }),
}));

const { changeEmail } = await import("./actions");

const input = (email: string) => ({ email, password: FAKE_DB_PASSWORD });
const almostThere = (email: string) =>
  `Almost there. Check ${email} (and your current inbox) to confirm the change.`;

beforeEach(() => {
  auth.getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } }, error: null });
  auth.updateUser.mockReset();
  notices.requested.length = 0;
  notices.afterQueue.length = 0;
});

describe("change email: never reveals whether an address is registered", () => {
  it("a free address: Almost there", async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    expect(await changeEmail(input("new@test.local"))).toEqual({
      ok: true,
      message: almostThere("new@test.local"),
    });
    expect(notices.afterQueue).toHaveLength(0);
  });

  it("a taken address: exactly the same answer, and that address gets the account-exists email", async () => {
    auth.updateUser.mockResolvedValue({
      data: {},
      error: { code: "email_exists", status: 422, message: "email exists" },
    });
    expect(await changeEmail(input("taken@test.local"))).toEqual({
      ok: true,
      message: almostThere("taken@test.local"),
    });
    for (const fn of notices.afterQueue.splice(0)) await fn();
    expect(notices.requested).toEqual(["taken@test.local"]);
  });

  it("anything else: the generic message", async () => {
    auth.updateUser.mockResolvedValue({
      data: {},
      error: { code: "unexpected_failure", status: 500, message: "boom" },
    });
    expect(await changeEmail(input("new@test.local"))).toEqual({
      ok: false,
      message: "Something went wrong on our side. Please try again.",
    });
  });
});
