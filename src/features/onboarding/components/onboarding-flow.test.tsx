import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const completeOnboarding = vi.fn();
vi.mock("../actions", () => ({
  completeOnboarding: (...a: unknown[]) => completeOnboarding(...a),
}));

const { OnboardingFlow } = await import("./onboarding-flow");
const { ONBOARDING_DRAFT_KEY, useOnboardingDraft } = await import("../store");

const USER = "user-a";

function renderFlow(userId = USER, firstName = "Sara") {
  return render(<OnboardingFlow userId={userId} initialFirstName={firstName} />);
}
const noor = () => document.querySelector<HTMLElement>("aside p[aria-live='polite']")!;
/** The action bar's message: the one thing announced when Continue needs something. */
const needs = () => document.getElementById("onboarding-needs")!;
const progress = () => screen.getByRole("progressbar", { name: "Setup progress" });
const pressContinue = () =>
  userEvent.click(screen.getByRole("button", { name: /Continue|Finish/ }));

async function fillYou() {
  await userEvent.selectOptions(screen.getAllByRole("combobox", { name: "Day" })[0]!, "29");
  await userEvent.selectOptions(screen.getAllByRole("combobox", { name: "Month" })[0]!, "2");
}

beforeEach(() => {
  completeOnboarding.mockReset();
  sessionStorage.clear();
  act(() => useOnboardingDraft.setState({ ...useOnboardingDraft.getState(), ownerId: null }));
  act(() => useOnboardingDraft.getState().reset());
});

describe("Onboarding · step 1, You", () => {
  it("story: name prefilled, birthday as day + month, year optional and private", () => {
    renderFlow();
    expect(screen.getByRole("heading", { level: 1, name: "First, you" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your first name")).toHaveValue("Sara");
    expect(screen.getByRole("group", { name: "Your birthday" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Year (optional)" })).toBeInTheDocument();
    expect(
      screen.getByText("Just the day and month. Your year stays private."),
    ).toBeInTheDocument();
    expect(progress()).toHaveAttribute("aria-valuenow", "0");
    expect(progress()).toHaveAttribute("aria-valuetext", "Step 1 of 4");
    expect(noor()).toHaveTextContent("Hi Sara! I'm Noor");
  });

  it("Continue explains what's missing in the bar and on the field, and focuses it", async () => {
    renderFlow();
    const before = noor().textContent;
    await pressContinue();

    const day = screen.getByRole("combobox", { name: "Day" });
    expect(day).toHaveAttribute("aria-invalid", "true");
    expect(day).toHaveAccessibleDescription(/Pick your birthday: day and month\./);
    await waitFor(() => expect(day).toHaveFocus());
    expect(needs()).toHaveAttribute("aria-live", "polite");
    expect(needs()).toHaveTextContent("Pick your birthday day and month to continue.");
    expect(noor().textContent).toBe(before); // only the bar is announced
    expect(screen.getByRole("button", { name: "Continue" })).not.toBeDisabled();
  });

  it("keeps the first name to 40 characters in the input", () => {
    renderFlow();
    expect(screen.getByLabelText("Your first name")).toHaveAttribute("maxlength", "40");
  });

  it("moves on once the birthday is filled in", async () => {
    renderFlow();
    await fillYou();
    await pressContinue();
    expect(screen.getByRole("heading", { level: 1, name: "Your look" })).toBeInTheDocument();
    expect(progress()).toHaveAttribute("aria-valuenow", "1");
    expect(noor()).toHaveTextContent("Nice! I love that.");
    expect(needs()).toBeEmptyDOMElement();
  });

  it("has no Back on the first step; Back sits above the title afterwards", async () => {
    renderFlow();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    await fillYou();
    await pressContinue();
    const back = screen.getByRole("button", { name: "Back" });
    expect(
      back.compareDocumentPosition(screen.getByRole("heading", { level: 1 })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(back);
    expect(screen.getByRole("heading", { level: 1, name: "First, you" })).toBeInTheDocument();
  });
});

describe("Onboarding · step 2, Your look", () => {
  beforeEach(() => {
    act(() => useOnboardingDraft.setState({ ownerId: USER, step: 1 }));
  });

  it("story: initials or character, six colours, characters with a live preview", async () => {
    renderFlow();
    const colours = screen.getByRole("radiogroup", { name: "Colour" });
    expect(within(colours).getAllByRole("radio")).toHaveLength(6);
    await userEvent.click(within(colours).getByRole("radio", { name: "Mint" }));
    expect(within(colours).getByRole("radio", { name: "Mint" })).toBeChecked();

    await userEvent.click(screen.getByRole("radio", { name: "Character" }));
    const characters = screen.getByRole("radiogroup", { name: "Character" });
    expect(within(characters).getAllByRole("radio")).toHaveLength(8);
    await userEvent.click(within(characters).getByRole("radio", { name: /Panda/ }));
    expect(useOnboardingDraft.getState().look).toMatchObject({
      kind: "character",
      color: "mint",
      character: "panda",
    });
    expect(screen.getAllByText("🐼", { selector: "[data-slot='avatar'] span" })).not.toHaveLength(
      0,
    );
  });

  it("Shuffle changes type, colour and character; Skip moves on", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.99);
    renderFlow();
    await userEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    expect(useOnboardingDraft.getState().look).toEqual({
      kind: "character",
      color: "butter",
      character: "moon",
    });
    random.mockRestore();
    expect(
      screen.getByText("Want a photo instead? Add one later from your profile."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Your first person" }),
    ).toBeInTheDocument();
  });
});

describe("Onboarding · step 3, First person", () => {
  beforeEach(() => {
    act(() => useOnboardingDraft.setState({ ownerId: USER, step: 2 }));
  });

  it("story: name, relation chips, birthday and a little thing, with a live preview", async () => {
    renderFlow();
    await userEvent.type(screen.getByLabelText("Their name"), "Khalid");
    await userEvent.tab(); // blur: Noor reacts once
    expect(noor()).toHaveTextContent("Ooh, Khalid!");

    await userEvent.click(screen.getByRole("radio", { name: "Family" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Day" }), "14");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Month" }), "3");
    await userEvent.type(
      screen.getByLabelText("A little thing they love (optional)"),
      "black coffee",
    );

    // Preview (in the step below 1024px, in Noor's column above): Family is sky.
    expect(screen.getAllByText("🎂 14 March")[0]).toHaveClass("bg-sky", "text-sky-ink");
    expect(screen.getAllByText("Loves black coffee")).not.toHaveLength(0);
    expect(screen.getByRole("radio", { name: "Family" })).toBeChecked();
    await pressContinue();
    expect(
      screen.getByRole("heading", { level: 1, name: "When should I nudge you?" }),
    ).toBeInTheDocument();
  });

  it("Continue without a name or birthday explains both; Skip still works", async () => {
    renderFlow();
    await pressContinue();
    expect(screen.getByLabelText("Their name")).toHaveAccessibleDescription(/What's their name\?/);
    expect(needs()).toHaveTextContent("Add their name and birthday, or skip for now.");
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(useOnboardingDraft.getState().person.skipped).toBe(true);
  });
});

describe("Onboarding · step 4, Reminders, and Done", () => {
  beforeEach(() => {
    act(() =>
      useOnboardingDraft.setState({
        ownerId: USER,
        step: 3,
        you: { firstName: "Sara", day: 29, month: 2, year: null },
        person: { ...useOnboardingDraft.getState().person, skipped: true },
      }),
    );
  });

  it("relation chips show their colour; their name is kept to 40 characters", () => {
    act(() => useOnboardingDraft.setState({ ownerId: USER, step: 2 }));
    renderFlow();
    expect(screen.getByLabelText("Their name")).toHaveAttribute("maxlength", "40");
    const bestFriend = screen.getByRole("radio", { name: "Best friend" });
    expect(bestFriend).toBeChecked();
    expect(bestFriend).toHaveClass("data-[state=checked]:bg-rose");
    expect(screen.getByRole("radio", { name: "Colleague" })).toHaveClass(
      "data-[state=checked]:bg-mint",
    );
  });

  it("asks how you'd describe them (optional, 30 characters) and shows it in the preview", async () => {
    act(() => useOnboardingDraft.setState({ ownerId: USER, step: 2 }));
    renderFlow();
    const description = screen.getByLabelText("How you'd describe them (optional)");
    expect(description).toHaveAttribute("maxlength", "30");
    expect(screen.getAllByText("Best friend").length).toBeGreaterThan(1); // chip + preview
    await userEvent.type(description, "Little sister");
    expect(useOnboardingDraft.getState().person.description).toBe("Little sister");
    expect(screen.getAllByText("Little sister")).not.toHaveLength(0);
  });

  it("previews a reminder with the first person's name", () => {
    act(() =>
      useOnboardingDraft.setState({
        person: { ...useOnboardingDraft.getState().person, skipped: false, name: "Sara" },
      }),
    );
    renderFlow();
    expect(screen.getByText("Sara's birthday is in 7 days")).toBeInTheDocument();
  });

  it("previews a generic reminder when the first person was skipped", () => {
    renderFlow();
    expect(screen.getByText("A friend's birthday is in 7 days")).toBeInTheDocument();
  });

  it("story: 7, 1 and 0 days pre-picked out of five, email and notifications", async () => {
    renderFlow();
    const when = screen.getByRole("group", { name: "Before each day" });
    const pressed = within(when)
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.textContent);
    expect(within(when).getAllByRole("button")).toHaveLength(5);
    expect(pressed).toEqual(["7 days before", "The day before", "The morning of"]);

    expect(screen.getByRole("switch", { name: /Email/ })).toBeChecked();
    const push = screen.getByRole("switch", { name: /Notifications/ });
    expect(push).not.toBeChecked();
    await userEvent.click(push);
    expect(push).toHaveAccessibleDescription(
      "We'll ask your browser later, when notifications are ready.",
    );
  });

  it("needs at least one reminder", async () => {
    renderFlow();
    const when = screen.getByRole("group", { name: "Before each day" });
    for (const b of within(when).getAllByRole("button", { pressed: true }))
      await userEvent.click(b);
    await pressContinue();
    expect(needs()).toHaveTextContent("Pick at least one, so I know when to nudge you.");
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it("Finish saves once, clears the draft and shows You're all set", async () => {
    completeOnboarding.mockResolvedValue({ ok: true, personName: null });
    renderFlow();
    await userEvent.click(screen.getByRole("button", { name: "2 weeks before" }));
    await pressContinue();

    expect(
      await screen.findByRole("heading", { level: 1, name: "You're all set, Sara" }),
    ).toBeInTheDocument();
    expect(completeOnboarding).toHaveBeenCalledOnce();
    expect(completeOnboarding.mock.calls[0]?.[0]).toMatchObject({
      person: { skipped: true },
      reminders: { offsets: [14, 7, 1, 0], email: true, push: false },
    });
    expect(screen.getByRole("link", { name: "Take me home" })).toHaveAttribute("href", "/home");
    expect(progress()).toHaveAttribute("aria-valuetext", "All done");
    expect(sessionStorage.getItem(ONBOARDING_DRAFT_KEY) ?? "").not.toContain("Sara");
  });

  it("goes back to the right step when the server finds a problem", async () => {
    completeOnboarding.mockResolvedValue({
      ok: false,
      step: 0,
      message: "That birthday doesn't look right.",
    });
    renderFlow();
    await pressContinue();
    expect(
      await screen.findByRole("heading", { level: 1, name: "First, you" }),
    ).toBeInTheDocument();
    expect(needs()).toHaveTextContent("That birthday doesn't look right.");
  });
});

describe("Onboarding · draft", () => {
  it("is kept in sessionStorage, so a refresh resumes where you were", async () => {
    const first = renderFlow();
    await fillYou();
    await pressContinue();
    expect(JSON.parse(sessionStorage.getItem(ONBOARDING_DRAFT_KEY)!).state).toMatchObject({
      step: 1,
      you: { day: 29, month: 2 },
    });
    first.unmount();
    renderFlow();
    expect(screen.getByRole("heading", { level: 1, name: "Your look" })).toBeInTheDocument();
  });

  it("starts fresh for a different person on the same tab", () => {
    act(() => useOnboardingDraft.setState({ ownerId: "someone-else", step: 2 }));
    renderFlow(USER, "Sara");
    expect(screen.getByRole("heading", { level: 1, name: "First, you" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your first name")).toHaveValue("Sara");
  });
});
