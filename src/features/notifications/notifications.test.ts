import { describe, expect, it } from "vitest";

import {
  base64UrlToBytes,
  deviceLabel,
  installState,
  isAppleMobile,
  notificationState,
} from "./device";
import { dayLabel, testPushMessage } from "./messages";

const UA = {
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0",
  firefoxMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:132.0) Gecko/20100101 Firefox/132.0",
  ipadDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
};

describe("devices", () => {
  it("labels the device in plain words", () => {
    expect(deviceLabel(UA.chromeAndroid)).toBe("Chrome on Android");
    expect(deviceLabel(UA.safariIphone)).toBe("Safari on iPhone");
    expect(deviceLabel(UA.edgeWindows)).toBe("Edge on Windows");
    expect(deviceLabel(UA.firefoxMac)).toBe("Firefox on Mac");
    expect(deviceLabel("")).toBe("Browser");
  });

  it("knows iPhone and iPad (iPadOS says it's a Mac, but with touch)", () => {
    expect(isAppleMobile(UA.safariIphone)).toBe(true);
    expect(isAppleMobile(UA.ipadDesktop, 5)).toBe(true);
    expect(isAppleMobile(UA.ipadDesktop, 0)).toBe(false);
    expect(isAppleMobile(UA.chromeAndroid)).toBe(false);
  });

  it("reads the VAPID key", () => {
    const bytes = base64UrlToBytes(
      "BG_wO5SSQc4drdQ1GeaWDgqFtBppoFwygQOqK84VlMoWPE91OlW_AdxT9sCwx-7ni0DG_30lqW4igrmJzvccFEo",
    );
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });
});

describe("notification states", () => {
  const base = {
    ready: true,
    hasKey: true,
    supported: true,
    appleMobile: false,
    standalone: false,
    permission: "default" as NotificationPermission,
    subscribed: false,
  };
  it.each([
    [{ ready: false }, "loading"],
    [{ hasKey: false }, "unavailable"],
    [{ appleMobile: true }, "ios-install"],
    [{ appleMobile: true, standalone: true }, "off"],
    [{ supported: false }, "unsupported"],
    [{ permission: "denied" as NotificationPermission }, "blocked"],
    [{}, "off"],
    [{ permission: "granted" as NotificationPermission, subscribed: true }, "on"],
  ])("%o → %s", (patch, state) => {
    expect(notificationState({ ...base, ...patch })).toBe(state);
  });

  it("install: installed, browser prompt, iPhone steps, or the menu", () => {
    expect(installState({ standalone: true, canPrompt: true, appleMobile: false })).toBe(
      "installed",
    );
    expect(installState({ standalone: false, canPrompt: true, appleMobile: false })).toBe("prompt");
    expect(installState({ standalone: false, canPrompt: false, appleMobile: true })).toBe("ios");
    expect(installState({ standalone: false, canPrompt: false, appleMobile: false })).toBe(
      "manual",
    );
  });
});

describe("words", () => {
  it("test notification results", () => {
    expect(testPushMessage({ ok: true, sent: 1 })).toBe(
      "Sent to 1 device. It should pop up in a moment.",
    );
    expect(testPushMessage({ ok: true, sent: 2 })).toMatch(/^Sent to 2 devices/);
    expect(testPushMessage({ ok: false, code: "too_many" })).toMatch(/3 test notifications/);
    expect(testPushMessage({ ok: false, code: "no_devices" })).toMatch(/Turn on notifications/);
    expect(testPushMessage({ ok: false, code: "failed" })).toMatch(/couldn't send it/);
  });

  it("device dates", () => {
    expect(dayLabel("2026-11-14", "2026-11-14", "2026-11-13")).toBe("today");
    expect(dayLabel("2026-11-13", "2026-11-14", "2026-11-13")).toBe("yesterday");
    expect(dayLabel("2026-11-02", "2026-11-14", "2026-11-13")).toBe("2 Nov");
    expect(dayLabel(null, "2026-11-14", "2026-11-13")).toBeNull();
  });
});
