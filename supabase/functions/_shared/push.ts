/**
 * Web push (RFC 8030/8291/8292) with jsr:@negrel/webpush (pinned in
 * deno.json / deno.lock; why: docs/decisions.md). On top of the library:
 * - a NEW application server (ECDH key pair) per message, as RFC 8291 expects;
 * - known push services only (never an arbitrary URL from the database);
 * - a 10-second timeout; 404 and 410 both mean "this device is gone".
 *
 * PUSH_MOCK=1 on a local Supabase: requests to push services are answered
 * locally (201, or 410 for endpoints ending in /gone) after real encryption
 * and VAPID signing, so e2e tests exercise everything but the network.
 */
import { ApplicationServer, importVapidKeys, PushMessageError } from "@negrel/webpush";

import { isPushEndpoint, type PushPayload } from "../../../src/features/reminders/push.ts";

import { isLocal } from "./env.ts";

export type Device = { id: string; endpoint: string; p256dh: string; auth: string };
export type DeviceResult = { id: string; status: "sent" | "gone" | "failed" };

const b64urlToBytes = (value: string) => {
  const b64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};
const bytesToB64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** The standard base64url VAPID keys (65-byte public, 32-byte private) as JWKs. */
export function vapidJwks(publicKey: string, privateKey: string) {
  const pub = b64urlToBytes(publicKey);
  const priv = b64urlToBytes(privateKey);
  if (pub.length !== 65 || pub[0] !== 4 || priv.length !== 32) {
    throw new Error("VAPID keys must be base64url: 65-byte public key, 32-byte private key");
  }
  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));
  const base = { kty: "EC", crv: "P-256", x, y, ext: true };
  return {
    publicKey: { ...base, key_ops: ["verify"] } as JsonWebKey,
    privateKey: { ...base, d: bytesToB64url(priv), key_ops: ["sign"] } as JsonWebKey,
  };
}

export const pushMockOn = () => Deno.env.get("PUSH_MOCK") === "1" && isLocal();

let mockInstalled = false;
/** Local e2e only: answer push-service requests here instead of on the network. */
function installMock() {
  if (mockInstalled) return;
  mockInstalled = true;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (isPushEndpoint(url)) {
      const ok = (init?.headers as Record<string, string> | undefined)?.Authorization?.startsWith(
        "vapid t=",
      );
      return Promise.resolve(
        new Response(null, { status: url.endsWith("/gone") ? 410 : ok ? 201 : 400 }),
      );
    }
    return realFetch(input, init);
  };
}

let vapid: Promise<CryptoKeyPair> | null = null;
function vapidKeys() {
  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set");
  // The fake pair from local-dev.env (0x01 bytes) only works on a local Supabase.
  if (priv.startsWith("AQEBAQEBAQEB") && !isLocal()) {
    throw new Error("VAPID_PRIVATE_KEY is the local placeholder; set a real key for this project");
  }
  vapid ??= importVapidKeys(vapidJwks(pub, priv));
  return vapid;
}

const withTimeout = <T>(promise: Promise<T>, ms: number) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("push timeout")), ms)),
  ]);

export const pushConfigured = () =>
  Boolean(Deno.env.get("VAPID_PUBLIC_KEY") && Deno.env.get("VAPID_PRIVATE_KEY"));

/** Sends one payload to each device; reports sent / gone / failed per device. */
export async function pushToDevices(
  devices: Device[],
  payload: PushPayload,
): Promise<DeviceResult[]> {
  if (pushMockOn()) installMock();
  const keys = await vapidKeys();
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noor@mail.shemme.codes";
  const body = JSON.stringify(payload);
  const results: DeviceResult[] = [];
  for (const device of devices) {
    if (!isPushEndpoint(device.endpoint)) {
      results.push({ id: device.id, status: "gone" });
      continue;
    }
    try {
      // A fresh application server = a fresh ECDH key pair for this message.
      const server = await ApplicationServer.new({ contactInformation: subject, vapidKeys: keys });
      const subscriber = server.subscribe({
        endpoint: device.endpoint,
        keys: { p256dh: device.p256dh, auth: device.auth },
      });
      // TTL one day: a reminder that arrives days late is worse than none.
      // Topic = the batch id: a retried batch replaces an undelivered copy.
      const topic = payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined;
      await withTimeout(subscriber.pushTextMessage(body, { ttl: 86_400, topic }), 10_000);
      results.push({ id: device.id, status: "sent" });
    } catch (error) {
      const status = error instanceof PushMessageError ? error.response.status : 0;
      results.push({ id: device.id, status: status === 404 || status === 410 ? "gone" : "failed" });
    }
  }
  return results;
}
