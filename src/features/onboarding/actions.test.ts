import { beforeEach, describe, expect, it, vi } from "vitest";

class Redirect extends Error {
  constructor(public url: string) {
    super(url);
  }
}

const rpc = vi.fn();
let signedIn = true;

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: async () => ({ data: signedIn ? { claims: { sub: "user-a" } } : null }) },
    rpc,
  }),
}));

const { completeOnboarding } = await import("./actions");

const draft = {
  you: { firstName: "Sara", day: 29, month: 2, year: null },
  look: { kind: "character", color: "lilac", character: "fox" },
  person: {
    skipped: false,
    name: "Khalid",
    relation: "Best friend",
    day: 14,
    month: 3,
    year: null,
    littleThing: "black coffee",
  },
  reminders: { offsets: [14, 7, 1, 0], email: true, push: true },
  timezone: "Africa/Casablanca",
};

async function run(input: unknown) {
  try {
    return { result: await completeOnboarding(input) };
  } catch (e) {
    if (e instanceof Redirect) return { redirect: e.url };
    throw e;
  }
}

beforeEach(() => {
  rpc.mockReset();
  signedIn = true;
});

describe("completeOnboarding", () => {
  it("calls complete_onboarding once with everything, the person in their relation's colour", async () => {
    rpc.mockResolvedValue({ data: "person-1", error: null });
    const { result } = await run(draft);

    expect(result).toEqual({ ok: true, personName: "Khalid" });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("complete_onboarding", {
      p_first_name: "Sara",
      p_birthday_day: 29,
      p_birthday_month: 2,
      p_birth_year: undefined,
      p_avatar_kind: "character",
      p_avatar_color: "lilac",
      p_avatar_character: "fox",
      p_person_name: "Khalid",
      p_person_relation: "Best friend",
      p_person_color: "rose",
      p_person_birthday_day: 14,
      p_person_birthday_month: 3,
      p_person_birthday_year: undefined,
      p_person_little_thing: "black coffee",
      p_reminder_offsets: [14, 7, 1, 0],
      p_reminder_email: true,
      p_reminder_push: true,
      p_timezone: "Africa/Casablanca",
    });
  });

  it("sends no person fields when the first person was skipped", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { result } = await run({ ...draft, person: { skipped: true } });
    expect(result).toEqual({ ok: true, personName: null });
    const params = rpc.mock.calls[0]?.[1];
    expect(params.p_person_name).toBeUndefined();
    expect(params.p_person_birthday_day).toBeUndefined();
  });

  it("validates with Zod before calling the database", async () => {
    const { result } = await run({ ...draft, you: { ...draft.you, day: 30, month: 2 } });
    expect(result).toMatchObject({
      ok: false,
      step: 0,
      message: "That day doesn't exist in that month.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("turns a database error code into the right step and friendly copy", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "invalid_person_birthday", code: "22023" },
    });
    expect((await run(draft)).result).toEqual({
      ok: false,
      step: 2,
      message: "Their birthday doesn't look right.",
    });
  });

  it("sends people who already finished to /home", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "already_onboarded", code: "22023" } });
    expect((await run(draft)).redirect).toBe("/home");
  });

  it("sends signed-out people to log in", async () => {
    signedIn = false;
    expect((await run(draft)).redirect).toBe("/log-in?next=%2Fonboarding");
    expect(rpc).not.toHaveBeenCalled();
  });
});
