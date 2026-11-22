import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
vi.mock("@/components/ui/sonner", () => ({ toast }));
const linkPersonToAccount = vi.fn();
const addPersonFromConnection = vi.fn();
const unlinkPersonFromAccount = vi.fn();
const applyAccountBirthday = vi.fn();
vi.mock("@/features/connections/actions", () => ({
  linkPersonToAccount: (a: unknown) => linkPersonToAccount(a),
  addPersonFromConnection: (a: unknown) => addPersonFromConnection(a),
  unlinkPersonFromAccount: (a: unknown) => unlinkPersonFromAccount(a),
  applyAccountBirthday: (a: unknown) => applyAccountBirthday(a),
}));

const { AccountSection, LinkPrompt } = await import("./link-account");
import type { Account, LinkCandidate } from "./link-account";

const CHAMA: Account = {
  profileId: "00000000-0000-4000-8000-00000000c001",
  firstName: "Chama",
  linkedPersonId: null,
  birthday: { day: 3, month: 3 },
  pastel: "sky",
  photoUrl: null,
  character: null,
};
const PEOPLE: LinkCandidate[] = [
  {
    id: "00000000-0000-4000-8000-0000000000a1",
    name: "Chama K.",
    color: "rose",
    birthday: { day: 12, month: 4 },
  },
  { id: "00000000-0000-4000-8000-0000000000a2", name: "Omar", color: "mint", birthday: null },
];

beforeEach(() => vi.clearAllMocks());

describe("Someone joined through your link", () => {
  it("a banner asks; the list is searchable; Link links (never matched for you)", async () => {
    linkPersonToAccount.mockResolvedValue({ ok: true, merged: null, theirBirthday: null });
    render(<LinkPrompt joiners={[CHAMA]} candidates={PEOPLE} />);
    expect(
      screen.getByText(/joined through your link\. Is this someone you already added\?/),
    ).toBeVisible();
    expect(linkPersonToAccount).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Choose" }));
    const dialog = screen.getByRole("dialog", { name: "Is Chama someone you already added?" });
    await userEvent.type(within(dialog).getByLabelText("Your people"), "cha");
    const list = within(dialog).getByRole("list", { name: "People you could link" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    await userEvent.click(within(dialog).getByRole("button", { name: "Link Chama K." }));
    expect(linkPersonToAccount).toHaveBeenCalledWith({
      personId: PEOPLE[0]!.id,
      profileId: CHAMA.profileId,
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("a different birthday is asked about: Use theirs / Keep mine", async () => {
    linkPersonToAccount.mockResolvedValue({
      ok: true,
      merged: null,
      theirBirthday: { day: 3, month: 3 },
    });
    applyAccountBirthday.mockResolvedValue({ ok: true });
    render(<LinkPrompt joiners={[CHAMA]} candidates={PEOPLE} openFor={CHAMA.profileId} />);
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Link Chama K." }));
    expect(
      await within(dialog).findByText("Their profile says 3 March. Use theirs?"),
    ).toBeVisible();
    expect(applyAccountBirthday).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Use theirs" }));
    expect(applyAccountBirthday).toHaveBeenCalledWith(PEOPLE[0]!.id);
  });

  it("No, add as new: asks for a birthday when they don't share theirs", async () => {
    addPersonFromConnection.mockResolvedValue({ ok: true, personId: "new" });
    render(
      <LinkPrompt
        joiners={[{ ...CHAMA, birthday: null }]}
        candidates={[]}
        openFor={CHAMA.profileId}
      />,
    );
    const dialog = screen.getByRole("dialog");
    const bday = within(dialog).getByRole("group", { name: "Their birthday" });
    await userEvent.selectOptions(within(bday).getByRole("combobox", { name: "Day" }), "12");
    await userEvent.selectOptions(within(bday).getByRole("combobox", { name: "Month" }), "4");
    await userEvent.click(within(dialog).getByRole("button", { name: "No, add as new" }));
    expect(addPersonFromConnection).toHaveBeenCalledWith({
      profileId: CHAMA.profileId,
      day: 12,
      month: 4,
    });
  });

  it("nothing to ask when everyone is linked", () => {
    const { container } = render(<LinkPrompt joiners={[]} candidates={PEOPLE} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Edit → Their account", () => {
  it("linking an account that's another of my people says it merges, first", async () => {
    linkPersonToAccount.mockResolvedValue({ ok: true, merged: "Badr B.", theirBirthday: null });
    const onChanged = vi.fn();
    render(
      <AccountSection
        personId="p-keep"
        personName="Badr"
        linkedProfileId={null}
        accounts={[{ ...CHAMA, profileId: "b1", firstName: "Badr", linkedPersonId: "p-dup" }]}
        peopleNames={{ "p-keep": "Badr", "p-dup": "Badr B." }}
        onChanged={onChanged}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Link to account"), "b1");
    expect(screen.getByText(/Linking merges Badr B\. into Badr/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Link" }));
    expect(linkPersonToAccount).toHaveBeenCalledWith({ personId: "p-keep", profileId: "b1" });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Badr B. is merged into Badr");
  });

  it("linked: Unlink keeps my person", async () => {
    unlinkPersonFromAccount.mockResolvedValue({ ok: true });
    render(
      <AccountSection
        personId="p1"
        personName="Chama"
        linkedProfileId={CHAMA.profileId}
        accounts={[CHAMA]}
        peopleNames={{}}
        onChanged={() => {}}
      />,
    );
    expect(screen.getByText(/Linked to Chama's account/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Unlink" }));
    expect(unlinkPersonFromAccount).toHaveBeenCalledWith("p1");
  });
});
