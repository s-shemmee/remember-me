import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const createInvite = vi.fn();
const revokeInvite = vi.fn();
const removeConnection = vi.fn();
const linkConnection = vi.fn();
const acceptInvite = vi.fn();
vi.mock("../actions", () => ({
  createInvite: (...a: unknown[]) => createInvite(...a),
  revokeInvite: (...a: unknown[]) => revokeInvite(...a),
  removeConnection: (...a: unknown[]) => removeConnection(...a),
  linkConnection: (...a: unknown[]) => linkConnection(...a),
  acceptInvite: (...a: unknown[]) => acceptInvite(...a),
}));
const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
vi.mock("@/components/ui/sonner", () => ({ toast }));

const { ConnectedCard, InviteCard } = await import("./connections-screen");

/** Both Profile cards, as the page shows them. */
function ConnectionsScreen(p: {
  invites: React.ComponentProps<typeof InviteCard>["invites"];
  connections: React.ComponentProps<typeof ConnectedCard>["connections"];
  people: React.ComponentProps<typeof ConnectedCard>["people"];
}) {
  return (
    <>
      <InviteCard invites={p.invites} />
      <ConnectedCard connections={p.connections} people={p.people} />
    </>
  );
}
const { AcceptInvite } = await import("./accept-invite");
const { InviteLinkDialog } = await import("./invite-link-dialog");

const P_KHALID = "11111111-1111-4111-8111-111111111111";
const P_SARA = "22222222-2222-4222-8222-222222222222";
const AMINA = "33333333-3333-4333-8333-333333333333";
const props = {
  invites: [
    { id: "i1", personName: "Sara", made: "Made Tue, 10 Nov", expires: "Expires in 6 days" },
  ],
  connections: [
    {
      id: "c1",
      profileId: AMINA,
      name: "Amina",
      color: "rose" as const,
      character: null,
      linkedPersonId: null,
      since: "10 Nov",
    },
  ],
  people: [
    { id: P_KHALID, name: "Khalid", linkedProfileId: null },
    { id: P_SARA, name: "Sara", linkedProfileId: "44444444-4444-4444-8444-444444444444" },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("Connections on Profile", () => {
  it("lists open invites with Cancel, and cancels one", async () => {
    revokeInvite.mockResolvedValue({ ok: true });
    render(<ConnectionsScreen {...props} />);
    const invites = screen.getByRole("region", { name: "Invite your people" });
    expect(within(invites).getByText("For Sara")).toBeInTheDocument();
    expect(within(invites).getByText("Made Tue, 10 Nov · Expires in 6 days")).toBeInTheDocument();
    await userEvent.click(
      within(invites).getByRole("button", { name: "Cancel the invite for Sara, made tue, 10 nov" }),
    );
    await waitFor(() => expect(revokeInvite).toHaveBeenCalledWith("i1"));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows connections; 'This is…' only offers people not linked to someone else", async () => {
    linkConnection.mockResolvedValue({ ok: true });
    render(<ConnectionsScreen {...props} />);
    const list = screen.getByRole("region", { name: "Connected with you" });
    expect(within(list).getAllByText("Amina").length).toBeGreaterThan(0);
    const select = within(list).getByLabelText("This is…");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Not in my People", "Khalid"]);
    await userEvent.selectOptions(select, P_KHALID);
    await waitFor(() =>
      expect(linkConnection).toHaveBeenCalledWith({
        profileId: AMINA,
        personId: P_KHALID,
        currentPersonId: null,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Amina is Khalid in your People");
  });

  it("Remove asks first", async () => {
    removeConnection.mockResolvedValue({ ok: true });
    render(<ConnectionsScreen {...props} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Remove Amina from your connections" }),
    );
    const confirm = screen.getByRole("dialog", { name: "Remove Amina?" });
    expect(within(confirm).getByRole("button", { name: "Keep" })).toHaveFocus();
    expect(removeConnection).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removeConnection).toHaveBeenCalledWith("c1"));
    expect(toast).toHaveBeenCalledWith("You and Amina are no longer connected");
  });

  it("with no connections, an empty state (and no invite list)", () => {
    render(<ConnectionsScreen invites={[]} connections={[]} people={[]} />);
    expect(screen.queryByText("Open invites")).toBeNull();
    expect(screen.getByText("No connections yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All people" })).toHaveAttribute("href", "/people");
  });

  it("shows connections as avatars with their names", () => {
    render(<ConnectionsScreen {...props} />);
    const list = screen.getByRole("list", { name: "Your connections" });
    expect(within(list).getByText("Amina")).toBeInTheDocument();
  });

  it("Copy makes a link, shows it in the field, copies it, and says Copied for 2 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    createInvite.mockResolvedValue({ ok: true, url: "http://localhost:3000/invite/abc" });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<InviteCard invites={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/invite/abc");
    expect(screen.getByLabelText("Your invite link")).toHaveValue(
      "http://localhost:3000/invite/abc",
    );
    expect(await screen.findByRole("button", { name: "Copied" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(/Copied/);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    await vi.advanceTimersByTimeAsync(2100);
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy" })).toBeVisible());
    vi.useRealTimers();
  });
});

describe("Invite link dialog", () => {
  it("makes a link for a person and offers Copy", async () => {
    createInvite.mockResolvedValue({ ok: true, url: "http://localhost:3000/invite/abc" });
    render(
      <InviteLinkDialog open onOpenChange={() => {}} personId={P_KHALID} personName="Khalid" />,
    );
    expect(
      screen.getByRole("dialog", { name: "Invite Khalid to Remember Me" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Invite link")).toHaveValue("http://localhost:3000/invite/abc"),
    );
    expect(createInvite).toHaveBeenCalledExactlyOnceWith(P_KHALID);
    expect(screen.getByText(/It works once, for 7 days\./)).toBeInTheDocument();
  });

  it("says why when it can't", async () => {
    createInvite.mockResolvedValue({
      ok: false,
      message: "You have 20 open invites. Cancel one to make a new link.",
    });
    render(<InviteLinkDialog open onOpenChange={() => {}} />);
    expect(
      await screen.findAllByText("You have 20 open invites. Cancel one to make a new link."),
    ).not.toHaveLength(0);
  });
});

describe("Accept on the invite page", () => {
  it("connects and says so", async () => {
    acceptInvite.mockResolvedValue({ ok: true });
    render(<AcceptInvite token={"a".repeat(64)} inviterName="Amina" />);
    await userEvent.click(screen.getByRole("button", { name: "Connect with Amina" }));
    const heading = await screen.findByRole("heading", { name: /You're connected with Amina/ });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole("link", { name: "See your connections" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("explains a link that stopped working", async () => {
    acceptInvite.mockResolvedValue({
      ok: false,
      status: "expired",
      message: "This invite can't be used.",
    });
    render(<AcceptInvite token={"a".repeat(64)} inviterName="Amina" />);
    await userEvent.click(screen.getByRole("button", { name: "Connect with Amina" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This invite has expiredInvites last 7 days. Ask Amina for a new link.",
    );
  });
});
