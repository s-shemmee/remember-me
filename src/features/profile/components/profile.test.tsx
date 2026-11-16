import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: vi.fn() }));
const actions = { saveProfile: vi.fn(), discardAvatarUpload: vi.fn(), setShareBirthday: vi.fn() };
vi.mock("../actions", () => actions);

const { AboutYouForm } = await import("./about-you-form");
const { PrivacyCard } = await import("./privacy-card");

const initial = {
  firstName: "Maya",
  look: { kind: "initials" as const, color: "lilac" as const, character: null, photoPath: null },
  birthday: { day: 22, month: 11, year: 1994 },
  timezone: "Africa/Casablanca",
};

beforeEach(() => vi.clearAllMocks());

describe("Profile → About you", () => {
  it("saves name, look, birthday and time zone", async () => {
    actions.saveProfile.mockResolvedValue({ ok: true });
    render(<AboutYouForm userId="u1" initial={initial} initialPhotoUrl={null} />);
    const name = screen.getByLabelText("First name");
    await userEvent.clear(name);
    await userEvent.type(name, "Maya L");
    await userEvent.click(screen.getByRole("radio", { name: "Character" }));
    await userEvent.click(screen.getByRole("radio", { name: "Fox" }));
    await userEvent.selectOptions(screen.getByLabelText("Time zone"), "Europe/London");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(actions.saveProfile).toHaveBeenCalledWith({
      firstName: "Maya L",
      look: { kind: "character", color: "lilac", character: "fox", photoPath: null },
      birthday: { day: 22, month: 11, year: 1994 },
      timezone: "Europe/London",
    });
    expect(await screen.findByText("Saved ✓")).toHaveAttribute("aria-live", "polite");
  });

  it("the year is private, and the photo picker is a real labelled input", async () => {
    render(<AboutYouForm userId="u1" initial={initial} initialPhotoUrl={null} />);
    expect(screen.getByText(/The year is private/)).toBeVisible();
    await userEvent.click(screen.getByRole("radio", { name: "Photo" }));
    const picker = screen.getByLabelText("Your photo");
    expect(picker).toHaveAttribute("type", "file");
    expect(picker).toHaveAccessibleDescription(/remove its location data/);
  });

  it("shows what the server says is wrong", async () => {
    actions.saveProfile.mockResolvedValue({
      ok: false,
      message: "That date doesn't exist.",
      fieldErrors: { birthday: "That date doesn't exist." },
    });
    render(<AboutYouForm userId="u1" initial={initial} initialPhotoUrl={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect((await screen.findAllByText("That date doesn't exist.")).length).toBeGreaterThan(0);
  });
});

describe("Profile → Who can see what", () => {
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
