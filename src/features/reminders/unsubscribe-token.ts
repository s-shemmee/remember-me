/**
 * Signed unsubscribe tokens: `<user id>.<HMAC-SHA256(purpose:user id)>`,
 * base64url. No expiry (unsubscribe links must keep working). The secret
 * (UNSUBSCRIBE_SECRET) lives only in Supabase function secrets, so only the
 * Edge Functions sign and verify. Web Crypto: works in Node and Deno.
 */
const PURPOSE = "unsubscribe:email-reminders:v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const bin = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function key(secret: string) {
  if (secret.length < 32) throw new Error("UNSUBSCRIBE_SECRET must be at least 32 characters");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signUnsubscribeToken(userId: string, secret: string): Promise<string> {
  if (!UUID_RE.test(userId)) throw new Error("invalid user id");
  const sig = await crypto.subtle.sign(
    "HMAC",
    await key(secret),
    encoder.encode(`${PURPOSE}:${userId}`),
  );
  return `${userId}.${toBase64Url(sig)}`;
}

/** The user id when the token is genuine, otherwise null (constant-time check). */
export async function verifyUnsubscribeToken(
  token: string,
  secret: string,
): Promise<string | null> {
  if (typeof token !== "string" || token.length > 200) return null;
  const [userId, sig, extra] = token.split(".");
  if (!userId || !sig || extra !== undefined || !UUID_RE.test(userId)) return null;
  const bytes = fromBase64Url(sig);
  if (!bytes) return null;
  const ok = await crypto.subtle.verify(
    "HMAC",
    await key(secret),
    bytes,
    encoder.encode(`${PURPOSE}:${userId}`),
  );
  return ok ? userId : null;
}

/** Cheap shape check for the app's /unsubscribe page (the function verifies). */
export const looksLikeUnsubscribeToken = (token: unknown): token is string =>
  typeof token === "string" &&
  token.length <= 200 &&
  /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{20,}$/.test(token);
