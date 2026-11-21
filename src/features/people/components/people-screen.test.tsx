import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type PersonRow, peopleView } from "../view";

// next/navigation: useSearchParams follows history.pushState, as in Next.
const refresh = vi.fn();
vi.mock("next/navigation", async () => {
  const React = await import("react");
  const listeners = new Set<() => void>();
  const push = window.history.pushState.bind(window.history);
  window.history.pushState = (...args: Parameters<History["pushState"]>) => {
    push(...args);
    listeners.forEach((l) => l());
  };
  return {
    useRouter: () => ({ refresh }),
    useSearchParams: () =>
      new URLSearchParams(
        React.useSyncExternalStore(
          (cb) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
          },
          () => window.location.search,
        ),
      ),
  };
});

const savePerson = vi.fn();
const removePerson = vi.fn();
const restorePerson = vi.fn();
vi.mock("../actions", () => ({
  savePerson: (...a: unknown[]) => savePerson(...a),
  removePerson: (...a: unknown[]) => removePerson(...a),
  restorePerson: (...a: unknown[]) => restorePerson(...a),
}));

vi.mock("@/features/connections/actions", () => ({ createInvite: vi.fn() }));
vi.mock("@/features/profile/actions", () => ({ saveTheme: vi.fn() }));
vi.mock("@/features/plans/actions", () => ({
  startPlan: vi.fn(),
  tickStep: vi.fn(),
  renameStep: vi.fn(),
  removeStep: vi.fn(),
  addStep: vi.fn(),
  saveNote: vi.fn(),
}));

const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
vi.mock("@/components/ui/sonner", () => ({ toast }));
vi.mock("@/features/gift-ideas/actions", () => ({
  addGiftIdeaToPlan: vi.fn(),
  newGiftIdeas: vi.fn(),
  savedGiftIdeas: vi.fn(async () => null),
}));

const { PeopleScreen } = await import("./people-screen");

const today = { year: 2026, month: 11, day: 4 };
const KH = "11111111-1111-4111-8111-111111111111";
const MD = "22222222-2222-4222-8222-222222222222";
const OM = "33333333-3333-4333-8333-333333333333";
const rows: PersonRow[] = [
  {
    id: KH,
    name: "Khalid",
    relation: "Brother from uni",
    relation_kind: "Best friend",
    color: "butter",
    group: "friends",
    little_things: ["black coffee", "sci-fi"],
    occasions: [
      { id: "k1", kind: "birthday", title: null, day: 6, month: 11, year: 1996, recurring: true },
    ],
  },
  {
    id: MD,
    name: "Mom & Dad",
    relation: null,
    relation_kind: "Family",
    color: "sky",
    group: "family",
    little_things: [],
    occasions: [
      { id: "m1", kind: "birthday", title: null, day: 9, month: 1, year: null, recurring: true },
      {
        id: "m2",
        kind: "anniversary",
        title: null,
        day: 16,
        month: 11,
        year: 1994,
        recurring: true,
      },
    ],
  },
  {
    id: OM,
    name: "Omar",
    relation: null,
    relation_kind: "Colleague",
    color: "peach",
    group: "work",
    little_things: ["pizza Fridays"],
    occasions: [
      { id: "o1", kind: "birthday", title: null, day: 2, month: 12, year: null, recurring: true },
    ],
  },
];
const people = peopleView(rows, today);

const cards = () =>
  within(screen.getByRole("region", { name: "Your people" }))
    .getAllByRole("link")
    .map((a) => a.textContent);

beforeEach(() => {
  window.history.replaceState(null, "", "/people");
  vi.clearAllMocks();
});

describe("People screen", () => {
  it("lists people soonest first, in their colours, with their next day", () => {
    render(<PeopleScreen people={people} />);
    expect(screen.getByRole("heading", { level: 1, name: "People" })).toBeInTheDocument();
    expect(screen.getByText("3 people")).toBeInTheDocument();
    expect(cards()).toEqual([
      "KHKhalidBrother from uniBirthday · in 2 days",
      "MDMom & DadFamilyAnniversary · in 12 days",
      "OMOmarColleagueBirthday · in 28 days",
    ]);
    expect(screen.getByText("Birthday · in 2 days")).toHaveClass("bg-butter", "text-butter-ink");
  });

  it("searches by name and announces how many are shown", async () => {
    render(<PeopleScreen people={people} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search people" }), "om");
    expect(cards()).toEqual([
      "MDMom & DadFamilyAnniversary · in 12 days",
      "OMOmarColleagueBirthday · in 28 days",
    ]);
    expect(screen.getByText("2 people shown")).toBeInTheDocument();
  });

  it("filters by group with pressed chips, and says when no one matches", async () => {
    render(<PeopleScreen people={people} />);
    const work = screen.getByRole("button", { name: "Work" });
    await userEvent.click(work);
    expect(work).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    expect(cards()).toEqual(["OMOmarColleagueBirthday · in 28 days"]);
    await userEvent.type(screen.getByRole("searchbox"), "khalid");
    expect(
      screen.getByText("No one here yet. Try another filter, or add someone."),
    ).toBeInTheDocument();
  });

  it("opens a profile from the URL: days, little things, wishlist placeholder", () => {
    window.history.replaceState(null, "", `/people?person=${MD}`);
    render(<PeopleScreen people={people} />);
    const panel = screen.getByRole("region", { name: "Mom & Dad" });
    expect(within(panel).getByText("Anniversary, 32 years")).toBeInTheDocument();
    expect(within(panel).getByText("Mon, 16 November")).toBeInTheDocument();
    expect(within(panel).getByText("in 12 days")).toBeInTheDocument();
    expect(
      within(panel).getByText("Nothing yet. Add what they love, so gift ideas come easy."),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText("Not connected yet, so no shared wishlist."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Mom & Dad/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("gift ideas: only when switched on, and never for a Remembrance day or someone In memory", () => {
    const ask = /Ask Noor for gift ideas/;
    window.history.replaceState(null, "", `/people?person=${KH}`);
    const { unmount } = render(<PeopleScreen people={people} />);
    expect(screen.queryByRole("button", { name: ask })).not.toBeInTheDocument();
    unmount();

    render(<PeopleScreen people={people} giftIdeas />);
    expect(screen.getByRole("button", { name: ask })).toBeInTheDocument();
    cleanup();

    const remembered = peopleView(
      [
        {
          ...rows[0]!,
          occasions: [
            {
              id: "r1",
              kind: "remembrance",
              title: null,
              day: 8,
              month: 11,
              year: 2020,
              recurring: true,
            },
          ],
        },
      ],
      today,
    );
    const { unmount: u2 } = render(<PeopleScreen people={remembered} giftIdeas />);
    expect(screen.queryByRole("button", { name: ask })).not.toBeInTheDocument();
    u2();

    const inMemory = peopleView([{ ...rows[0]!, in_memory: true }], today);
    render(<PeopleScreen people={inMemory} giftIdeas />);
    expect(screen.getByRole("region", { name: "Khalid" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ask })).not.toBeInTheDocument();
  });

  it("choosing a card puts them in the URL and, on a phone, moves focus to their profile and back", async () => {
    render(<PeopleScreen people={people} />);
    await userEvent.click(screen.getByRole("link", { name: /^Omar/ }));
    expect(window.location.search).toBe(`?person=${OM}`);
    const heading = screen.getByRole("heading", { level: 2, name: "Omar" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText("pizza Fridays")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "All people" }));
    expect(window.location.search).toBe("");
    await waitFor(() => expect(screen.getByRole("link", { name: /^Omar/ })).toHaveFocus());
  });

  it("with no one yet, Noor invites you to add someone", () => {
    render(<PeopleScreen people={[]} />);
    expect(screen.getByText("0 people")).toBeInTheDocument();
    expect(screen.getByText(/Add the first person you'd hate to forget/)).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});

describe("Add and edit dialog", () => {
  it("Save explains what's missing once, marks the fields and focuses the name", async () => {
    render(<PeopleScreen people={people} />);
    await userEvent.click(screen.getByRole("button", { name: "Add someone" }));
    const dialog = screen.getByRole("dialog", { name: "Add someone" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Add person" }));

    expect(within(dialog).getByText("Add their name and birthday to save.")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    const name = within(dialog).getByLabelText("Their name");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAttribute("maxlength", "40");
    expect(name).toHaveAccessibleDescription(/What's their name\?/);
    await waitFor(() => expect(name).toHaveFocus());
    expect(savePerson).not.toHaveBeenCalled();
  });

  it("the colour follows the relation until you pick one", async () => {
    render(<PeopleScreen people={people} />);
    await userEvent.click(screen.getByRole("button", { name: "Add someone" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: "Rose" })).toBeChecked();
    await userEvent.click(within(dialog).getByRole("radio", { name: "Family" }));
    expect(within(dialog).getByRole("radio", { name: "Sky" })).toBeChecked();
    await userEvent.click(within(dialog).getByRole("radio", { name: "Butter" }));
    await userEvent.click(within(dialog).getByRole("radio", { name: "Colleague" }));
    expect(within(dialog).getByRole("radio", { name: "Butter" })).toBeChecked();
  });

  it("adds a person with a description, another day and little things", async () => {
    savePerson.mockResolvedValue({ ok: true, id: OM, name: "Yasmine" });
    render(<PeopleScreen people={people} />);
    await userEvent.click(screen.getByRole("button", { name: "Add someone" }));
    const dialog = screen.getByRole("dialog");

    await userEvent.type(within(dialog).getByLabelText("Their name"), "Yasmine");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Family" }));
    await userEvent.type(
      within(dialog).getByLabelText("How you'd describe them (optional)"),
      "Little sister",
    );
    expect(within(dialog).getByLabelText("How you'd describe them (optional)")).toHaveAttribute(
      "maxlength",
      "30",
    );
    const bday = within(dialog).getByRole("group", { name: "Their birthday" });
    await userEvent.selectOptions(within(bday).getByRole("combobox", { name: "Day" }), "14");
    await userEvent.selectOptions(within(bday).getByRole("combobox", { name: "Month" }), "4");

    await userEvent.click(
      within(dialog).getByRole("button", { name: /Add an anniversary or another day/ }),
    );
    await userEvent.selectOptions(within(dialog).getByLabelText("Kind of day"), "other");
    await userEvent.type(within(dialog).getByLabelText("What's the day called?"), "Name day");
    // Something else happens once by default; a name day repeats.
    expect(within(dialog).getByRole("radio", { name: "Once" })).toBeChecked();
    await userEvent.click(within(dialog).getByRole("radio", { name: "Every year" }));
    const date = within(dialog).getByRole("group", { name: "Date" });
    await userEvent.selectOptions(within(date).getByRole("combobox", { name: "Day" }), "3");
    await userEvent.selectOptions(within(date).getByRole("combobox", { name: "Month" }), "5");

    const thing = within(dialog).getByLabelText("Little things they love (optional)");
    await userEvent.type(thing, "sunflowers{Enter}watercolours{Enter}cats{Enter}");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove cats" }));
    // One still in the box counts too.
    await userEvent.type(thing, "her cat Mimi");

    await userEvent.click(within(dialog).getByRole("button", { name: "Add Yasmine" }));
    await waitFor(() => expect(savePerson).toHaveBeenCalledOnce());
    expect(savePerson.mock.calls[0]![0]).toMatchObject({
      id: null,
      name: "Yasmine",
      relationKind: "Family",
      description: "Little sister",
      color: "sky",
      day: 14,
      month: 4,
      littleThings: ["sunflowers", "watercolours", "her cat Mimi"],
      days: [
        {
          id: null,
          kind: "other",
          title: "Name day",
          day: 3,
          month: 5,
          year: null,
          recurring: true,
          repeatChosen: true,
        },
      ],
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Yasmine added");
    expect(refresh).toHaveBeenCalled();
    expect(window.location.search).toBe(`?person=${OM}`);
  }, 15_000); // types a lot; slow when the whole suite runs in parallel

  it("type chips fill the title and set the repeat; a repeat you chose stays", async () => {
    render(<PeopleScreen people={people} />);
    await userEvent.click(screen.getByRole("button", { name: "Add someone" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Add an anniversary or another day/ }),
    );
    const kind = within(dialog).getByLabelText("Kind of day");
    expect(
      within(kind)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Anniversary", "Graduation", "Work milestone", "Remembrance", "Something else"]);

    await userEvent.selectOptions(kind, "work_milestone");
    expect(within(dialog).getByRole("radio", { name: "Every year" })).toBeChecked();
    const suggestions = within(dialog).getByRole("group", { name: "Suggestions" });
    const title = within(dialog).getByLabelText("Title (optional)");
    expect(title).toHaveAttribute("placeholder", "e.g. New job");

    await userEvent.click(within(suggestions).getByRole("button", { name: "New job" }));
    expect(title).toHaveValue("New job");
    expect(within(suggestions).getByRole("button", { name: "New job" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await waitFor(() => expect(title).toHaveFocus());
    expect(within(dialog).getByRole("radio", { name: "Once" })).toBeChecked();
    expect(within(dialog).getByText("It happens once, so it needs the year.")).toBeInTheDocument();
    await userEvent.type(title, " in Rabat");
    expect(title).toHaveValue("New job in Rabat"); // still editable

    // Chosen by hand: chips and type changes no longer touch the repeat.
    await userEvent.click(within(dialog).getByRole("radio", { name: "Every year" }));
    await userEvent.click(within(suggestions).getByRole("button", { name: "Promotion" }));
    expect(title).toHaveValue("Promotion");
    expect(within(dialog).getByRole("radio", { name: "Every year" })).toBeChecked();

    await userEvent.selectOptions(kind, "remembrance");
    expect(within(dialog).queryByRole("group", { name: "Suggestions" })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Title (optional)")).toHaveAttribute(
      "placeholder",
      "In memory of…",
    );
  });

  it("a day that happens once needs its year; Something else needs a title", async () => {
    render(<PeopleScreen people={people} />);
    await userEvent.click(screen.getByRole("button", { name: "Add someone" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Their name"), "Lina");
    const bday = within(dialog).getByRole("group", { name: "Their birthday" });
    await userEvent.selectOptions(within(bday).getByRole("combobox", { name: "Day" }), "1");
    await userEvent.selectOptions(within(bday).getByRole("combobox", { name: "Month" }), "2");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Add an anniversary or another day/ }),
    );
    await userEvent.selectOptions(within(dialog).getByLabelText("Kind of day"), "other");
    expect(within(dialog).getByRole("radio", { name: "Once" })).toBeChecked();
    const date = within(dialog).getByRole("group", { name: "Date" });
    await userEvent.selectOptions(within(date).getByRole("combobox", { name: "Day" }), "3");
    await userEvent.selectOptions(within(date).getByRole("combobox", { name: "Month" }), "5");

    await userEvent.click(within(dialog).getByRole("button", { name: "Add Lina" }));
    expect(within(dialog).getByLabelText("What's the day called?")).toHaveAccessibleDescription(
      /What's the day called\?/,
    );
    expect(within(date).getByLabelText("Year (optional)")).toHaveAccessibleDescription(
      /Add the year, so I know when it happens\./,
    );
    expect(savePerson).not.toHaveBeenCalled();
  });

  it("shows the database's message on the field it's about", async () => {
    savePerson.mockResolvedValue({
      ok: false,
      message: "Their name needs a quick look.",
      fieldErrors: { name: "Their name needs a quick look." },
    });
    window.history.replaceState(null, "", `/people?person=${KH}`);
    render(<PeopleScreen people={people} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog", { name: "Edit person" });
    expect(within(dialog).getByLabelText("Their name")).toHaveValue("Khalid");
    expect(within(dialog).getByLabelText("How you'd describe them (optional)")).toHaveValue(
      "Brother from uni",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(within(dialog).getByLabelText("Their name")).toHaveAccessibleDescription(
        /Their name needs a quick look\./,
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Remove asks first, archives, and offers Undo", async () => {
    removePerson.mockResolvedValue({ ok: true });
    restorePerson.mockResolvedValue({ ok: true });
    window.history.replaceState(null, "", `/people?person=${OM}`);
    render(<PeopleScreen people={people} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /^Remove$/ }),
    );

    const confirm = screen.getByRole("dialog", { name: "Remove Omar?" });
    expect(within(confirm).getByRole("button", { name: "Keep them" })).toHaveFocus();
    expect(removePerson).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(removePerson).toHaveBeenCalledWith(OM));
    expect(window.location.search).toBe("");
    expect(toast).toHaveBeenCalledWith(
      "Omar removed",
      expect.objectContaining({ action: expect.anything() }),
    );
    const { action } = toast.mock.calls[0]![1] as {
      action: { label: string; onClick: () => Promise<void> };
    };
    expect(action.label).toBe("Undo");
    await act(() => action.onClick());
    expect(restorePerson).toHaveBeenCalledWith(OM);
    expect(window.location.search).toBe(`?person=${OM}`);
    expect(toast.success).toHaveBeenCalledWith("Omar is back");
  });

  it("Escape closes the dialog and returns focus to what opened it", async () => {
    render(<PeopleScreen people={people} />);
    const add = screen.getByRole("button", { name: "Add someone" });
    await userEvent.click(add);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(add).toHaveFocus());
  });
});
