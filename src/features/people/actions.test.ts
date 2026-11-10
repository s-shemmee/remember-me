import { beforeEach, describe, expect, it, vi } from "vitest";

class Redirect extends Error {
  constructor(public url: string) {
    super(url);
  }
}

const rpc = vi.fn();
const updates: { values: unknown; filters: string[] }[] = [];
let updateResult: { data: unknown; error: unknown } = { data: [{ id: "x" }], error: null };
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
    from: (table: string) => {
      const entry = { values: undefined as unknown, filters: [`table:${table}`] };
      const builder = {
        update(values: unknown) {
          entry.values = values;
          updates.push(entry);
          return builder;
        },
        eq(col: string, v: string) {
          entry.filters.push(`${col}=${v}`);
          return builder;
        },
        is(col: string, v: null) {
          entry.filters.push(`${col} is ${v}`);
          return builder;
        },
        not(col: string, op: string, v: null) {
          entry.filters.push(`${col} not ${op} ${v}`);
          return builder;
        },
        select: async () => updateResult,
      };
      return builder;
    },
  }),
}));

const { removePerson, restorePerson, savePerson } = await import("./actions");

const ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const DAY_ID = "16fd2706-8baf-433b-82eb-8c7fada847da";
const form = {
  id: null,
  name: " Mom ",
  relationKind: "Family",
  description: "",
  color: "butter",
  day: 9,
  month: 1,
  year: null,
  littleThings: ["roses"],
  days: [
    { id: DAY_ID, kind: "anniversary", title: "ignored", day: 16, month: 11, year: 1993 },
    { id: null, kind: "other", title: "Name day", day: 3, month: 5, year: null },
  ],
};

async function run<T>(fn: () => Promise<T>) {
  try {
    return { result: await fn() };
  } catch (e) {
    if (e instanceof Redirect) return { redirect: e.url };
    throw e;
  }
}

beforeEach(() => {
  rpc.mockReset();
  updates.length = 0;
  updateResult = { data: [{ id: ID }], error: null };
  signedIn = true;
});

describe("savePerson", () => {
  it("calls save_person once with trimmed values; only 'other' days keep a title", async () => {
    rpc.mockResolvedValue({ data: ID, error: null });
    const { result } = await run(() => savePerson(form));
    expect(result).toEqual({ ok: true, id: ID, name: "Mom" });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("save_person", {
      p_id: undefined,
      p_name: "Mom",
      p_relation_kind: "Family",
      p_relation: undefined,
      p_color: "butter",
      p_birthday_day: 9,
      p_birthday_month: 1,
      p_birthday_year: undefined,
      p_little_things: ["roses"],
      p_days: [
        { id: DAY_ID, kind: "anniversary", title: null, day: 16, month: 11, year: 1993 },
        { id: null, kind: "other", title: "Name day", day: 3, month: 5, year: null },
      ],
    });
  });

  it("passes the id and description when editing", async () => {
    rpc.mockResolvedValue({ data: ID, error: null });
    await run(() => savePerson({ ...form, id: ID, description: " Parents " }));
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_id: ID, p_relation: "Parents" });
  });

  it("never calls the database with invalid input", async () => {
    const { result } = await run(() => savePerson({ ...form, name: "", month: null }));
    expect(rpc).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { name: "What's their name?", month: "When is their birthday? Day and month." },
    });
    expect((await run(() => savePerson("nonsense"))).result).toMatchObject({ ok: false });
  });

  it("maps database errors to friendly copy", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "invalid_birthday" } });
    expect((await run(() => savePerson(form))).result).toEqual({
      ok: false,
      message: "Their birthday doesn't look right.",
      fieldErrors: { day: "Their birthday doesn't look right." },
    });
    rpc.mockResolvedValue({ data: null, error: { message: "not_found" } });
    expect((await run(() => savePerson({ ...form, id: ID }))).result).toMatchObject({
      ok: false,
      message: "I couldn't find them. They may have been removed.",
    });
    rpc.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });
    expect((await run(() => savePerson(form))).result).toEqual({
      ok: false,
      message: "Something went wrong on our side. Please try again.",
    });
  });

  it("sends signed-out people to log in", async () => {
    signedIn = false;
    expect(await run(() => savePerson(form))).toEqual({ redirect: "/log-in?next=%2Fpeople" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("removePerson and restorePerson", () => {
  it("removing archives the person (only if not already archived)", async () => {
    const { result } = await run(() => removePerson(ID));
    expect(result).toEqual({ ok: true });
    expect(updates).toHaveLength(1);
    expect((updates[0]!.values as { archived_at: string }).archived_at).toMatch(/^\d{4}-/);
    expect(updates[0]!.filters).toEqual(["table:people", `id=${ID}`, "archived_at is null"]);
  });

  it("Undo clears archived_at", async () => {
    await run(() => restorePerson(ID));
    expect(updates[0]!.values).toEqual({ archived_at: null });
    expect(updates[0]!.filters).toEqual(["table:people", `id=${ID}`, "archived_at not is null"]);
  });

  it("says so when nothing matched (someone else's, or already done)", async () => {
    updateResult = { data: [], error: null };
    expect((await run(() => removePerson(ID))).result).toEqual({
      ok: false,
      message: "I couldn't find them.",
    });
  });

  it("refuses a malformed id without touching the database", async () => {
    expect((await run(() => removePerson("1; drop table people"))).result).toMatchObject({
      ok: false,
    });
    expect(updates).toHaveLength(0);
  });
});
