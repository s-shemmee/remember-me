import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: vi.fn() }));
const actions = {
  saveAbout: vi.fn(),
  saveLook: vi.fn(),
  discardAvatarUpload: vi.fn(),
  setShareBirthday: vi.fn(),
};
vi.mock("../actions", () => actions);

const { AboutYouForm } = await import("./about-you-form");
const { AvatarEditor } = await import("./avatar-editor");
const { PrivacyCard } = await import("./privacy-card");
const { ProfileStats, WhoSeesWhat } = await import("./profile-cards");

const initial = {
  firstName: "Maya",
  lastName: "",
  birthday: { day: 22, month: 11, year: 1994 },
  city: "Rabat",
  bio: "",
  timezone: "Africa/Casablanca",
};
const look = {
  kind: "initials" as const,
  color: "lilac" as const,
  character: null,
  photoPath: null,
};

beforeEach(() => vi.clearAllMocks());

describe("Profile → About you", () => {
  it("saves names, birthday, city, little line and time zone; Save becomes Saved", async () => {
    actions.saveAbout.mockResolvedValue({ ok: true });
    render(<AboutYouForm initial={initial} />);
    await userEvent.type(screen.getByLabelText("Last name"), "Alaoui");
    await userEvent.type(screen.getByLabelText("Your little line"), "Tea first.");
    await userEvent.selectOptions(screen.getByLabelText("Time zone"), "Europe/London");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(actions.saveAbout).toHaveBeenCalledWith({
      firstName: "Maya",
      lastName: "Alaoui",
      city: "Rabat",
      bio: "Tea first.",
      birthday: { day: 22, month: 11, year: 1994 },
      timezone: "Europe/London",
    });
    expect(await screen.findByRole("button", { name: "Saved" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    // A new change makes it "Save" again.
    await userEvent.type(screen.getByLabelText("City"), "!");
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
  });

  it("the year is private, said in the spec's words", () => {
    render(<AboutYouForm initial={initial} />);
    expect(screen.getByText("Year is private. Only day and month are shown.")).toBeVisible();
  });

  it("shows what the server says is wrong", async () => {
    actions.saveAbout.mockResolvedValue({
      ok: false,
      message: "That date doesn't exist.",
      fieldErrors: { birthday: "That date doesn't exist." },
    });
    render(<AboutYouForm initial={initial} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findAllByText("That date doesn't exist.")).length).toBeGreaterThan(0);
  });
});

describe("Profile → avatar (Edit on the header card)", () => {
  it("edits the look in a dialog and saves it", async () => {
    actions.saveLook.mockResolvedValue({ ok: true });
    render(<AvatarEditor userId="u1" name="Maya" initial={look} initialPhotoUrl={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit your avatar" }));
    await userEvent.click(await screen.findByRole("radio", { name: "Character" }));
    await userEvent.click(screen.getByRole("radio", { name: "Fox" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(actions.saveLook).toHaveBeenCalledWith({
      kind: "character",
      color: "lilac",
      character: "fox",
      photoPath: null,
    });
  });

  it("the photo picker is a real labelled input", async () => {
    render(<AvatarEditor userId="u1" name="Maya" initial={look} initialPhotoUrl={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit your avatar" }));
    await userEvent.click(await screen.findByRole("radio", { name: "Photo" }));
    const picker = screen.getByLabelText("Your photo");
    expect(picker).toHaveAttribute("type", "file");
    expect(picker).toHaveAccessibleDescription(/remove its location data/);
  });
});

describe("Profile → numbers and who can see what", () => {
  it("shows all three tiles, 0 included", () => {
    render(<ProfileStats people={0} wishlists={2} days={1} />);
    const tiles = screen.getByRole("list", { name: "Your numbers" });
    expect(tiles).toHaveTextContent("0people");
    expect(tiles).toHaveTextContent("2wishlists");
    expect(tiles).toHaveTextContent("1day remembered");
  });

  it("the summary links to Settings → Privacy", () => {
    render(<WhoSeesWhat shareBirthday={false} />);
    expect(screen.getByText("Your birthday").closest("div")).toHaveTextContent("Only you");
    expect(screen.getByRole("link", { name: /privacy settings/ })).toHaveAttribute(
      "href",
      "/settings/privacy",
    );
  });
});

describe("Settings → Privacy: the birthday switch", () => {
  it("the birthday switch saves and says what changed", async () => {
    actions.setShareBirthday.mockResolvedValue({ ok: true });
    render(<PrivacyCard shareBirthday />);
    const sw = screen.getByRole("switch", { name: /Show my birthday to my connections/ });
    expect(sw).toBeChecked();
    expect(sw).toHaveAccessibleDescription(/never the year/);
    await userEvent.click(sw);
    expect(actions.setShareBirthday).toHaveBeenCalledWith(false);
    expect(
      await screen.findByText(/Hidden\. Your connections won't see your birthday/),
    ).toBeVisible();
  });

  it("a failed save switches back", async () => {
    actions.setShareBirthday.mockResolvedValue({
      ok: false,
      message: "That didn't save. Please try again.",
    });
    render(<PrivacyCard shareBirthday />);
    await userEvent.click(screen.getByRole("switch"));
    expect(await screen.findByText("That didn't save. Please try again.")).toBeVisible();
    expect(screen.getByRole("switch")).toBeChecked();
  });
});
