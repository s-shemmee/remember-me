import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
vi.mock("@/components/ui/sonner", () => ({ toast }));

const actions = {
  savePushSubscription: vi.fn(),
  removeDevice: vi.fn(),
  turnOffPush: vi.fn(),
  sendTestNotification: vi.fn(),
};
vi.mock("../actions", () => actions);

const browser = {
  pushSupported: vi.fn(() => true),
  isStandalone: vi.fn(() => false),
  currentSubscription: vi.fn(async () => null as { endpoint: string } | null),
  subscribeThisDevice: vi.fn(),
  unsubscribeThisDevice: vi.fn(async () => null),
};
vi.mock("../browser", () => browser);

const { NotificationsCard } = await import("./notifications-card");

const KEY =
  "BG_wO5SSQc4drdQ1GeaWDgqFtBppoFwygQOqK84VlMoWPE91OlW_AdxT9sCwx-7ni0DG_30lqW4igrmJzvccFEo";
const THIS = "https://fcm.googleapis.com/fcm/send/this-device";
const devices = [
  { id: "d1", label: "Chrome on Android", endpoint: THIS, line: "Added today · Last used today" },
  {
    id: "d2",
    label: "Safari on Mac",
    endpoint: "https://web.push.apple.com/other",
    line: "Added 2 Nov · Not used yet",
  },
];

function setPermission(permission: NotificationPermission) {
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: { permission, requestPermission: vi.fn() },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  browser.pushSupported.mockReturnValue(true);
  browser.isStandalone.mockReturnValue(false);
  browser.currentSubscription.mockResolvedValue(null);
  setPermission("default");
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Chrome/130 Linux" });
});

describe("Settings → Notifications", () => {
  it("never asks on load: one button, and the browser is only asked on tap", async () => {
    render(<NotificationsCard devices={[]} vapidKey={KEY} />);
    const button = await screen.findByRole("button", { name: "Turn on notifications" });
    expect(browser.subscribeThisDevice).not.toHaveBeenCalled();
    expect(screen.getByText(/I'll only ask your browser once you tap the button/)).toBeVisible();

    browser.subscribeThisDevice.mockResolvedValue({
      ok: true,
      subscription: { endpoint: THIS, keys: { p256dh: "p", auth: "a" }, label: "Chrome on Linux" },
    });
    actions.savePushSubscription.mockResolvedValue({ ok: true });
    browser.currentSubscription.mockResolvedValue({ endpoint: THIS });
    await userEvent.click(button);
    expect(browser.subscribeThisDevice).toHaveBeenCalledWith(KEY);
    expect(actions.savePushSubscription).toHaveBeenCalledWith({
      endpoint: THIS,
      keys: { p256dh: "p", auth: "a" },
      label: "Chrome on Linux",
    });
    expect(await screen.findByText("Notifications are on for this device ✓")).toBeVisible();
    expect(refresh).toHaveBeenCalled();
  });

  it("on: devices with Remove, this device marked, a test, and turning off", async () => {
    browser.currentSubscription.mockResolvedValue({ endpoint: THIS });
    setPermission("granted");
    actions.sendTestNotification.mockResolvedValue({
      ok: true,
      message: "Sent to 2 devices. They should pop up in a moment.",
    });
    render(<NotificationsCard devices={devices} vapidKey={KEY} />);
    const list = await screen.findByRole("list", { name: "Your devices" });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Chrome on Android · This device");
    expect(items[0]).toHaveTextContent("Added today · Last used today");
    expect(items[1]).not.toHaveTextContent("This device");

    await userEvent.click(screen.getByRole("button", { name: "Send me a test notification" }));
    expect(await screen.findByText(/Sent to 2 devices/)).toHaveAttribute("aria-live", "polite");

    actions.removeDevice.mockResolvedValue({ ok: true });
    await userEvent.click(screen.getByRole("button", { name: "Remove Safari on Mac" }));
    expect(actions.removeDevice).toHaveBeenCalledWith("d2");
    expect(browser.unsubscribeThisDevice).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Remove Chrome on Android (this device)" }),
    );
    expect(browser.unsubscribeThisDevice).toHaveBeenCalled();

    actions.turnOffPush.mockResolvedValue({ ok: true });
    await userEvent.click(screen.getByRole("button", { name: "Turn off notifications" }));
    expect(actions.turnOffPush).toHaveBeenCalled();
    expect(await screen.findByText("Notifications are off on all your devices.")).toBeVisible();
  });

  it("blocked: says how to allow them, no button", async () => {
    setPermission("denied");
    render(<NotificationsCard devices={[]} vapidKey={KEY} />);
    expect(await screen.findByText(/Notifications are blocked for this site/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Turn on notifications" })).toBeNull();
  });

  it("iPhone not installed: explains the Home Screen and iOS 16.4", async () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Safari/604.1",
    });
    render(<NotificationsCard devices={[]} vapidKey={KEY} />);
    expect(await screen.findByText(/Home Screen \(iOS 16\.4 or later\)/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Turn on notifications" })).toBeNull();
  });

  it("unsupported browser, or not set up yet", async () => {
    browser.pushSupported.mockReturnValue(false);
    const { unmount } = render(<NotificationsCard devices={[]} vapidKey={KEY} />);
    expect(await screen.findByText(/This browser can't show notifications/)).toBeVisible();
    unmount();
    browser.pushSupported.mockReturnValue(true);
    render(<NotificationsCard devices={[]} vapidKey={null} />);
    expect(await screen.findByText(/Notifications aren't available yet/)).toBeVisible();
  });

  it("a refused permission leaves it off without an error", async () => {
    browser.subscribeThisDevice.mockResolvedValue({ ok: false, reason: "denied" });
    render(<NotificationsCard devices={[]} vapidKey={KEY} />);
    await userEvent.click(await screen.findByRole("button", { name: "Turn on notifications" }));
    await waitFor(() => expect(browser.subscribeThisDevice).toHaveBeenCalled());
    expect(actions.savePushSubscription).not.toHaveBeenCalled();
  });
});
