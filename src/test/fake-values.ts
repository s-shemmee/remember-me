/**
 * Fake credentials for tests. The only place tests get key-like values from.
 *
 * Every value is obviously fake and low-entropy (`test` plus zeros), so it
 * can't be mistaken for a real key. Gitleaks allows exactly these strings
 * (.gitleaks.toml); anything else that looks like a key still fails the scan.
 * Add new fakes here, in the same style, and to .gitleaks.toml.
 */

export const FAKE_SUPABASE_URL = "https://test.supabase.co";
export const FAKE_PUBLISHABLE_KEY = "sb_publishable_test_00000000";
export const FAKE_SECRET_KEY = "sb_secret_test_00000000";
/** Shape of a legacy anon/service JWT (starts with "eyJ"). */
export const FAKE_LEGACY_JWT = "eyJ_test_00000000";
export const FAKE_DB_PASSWORD = "test_password_00000000";

/**
 * Edge Function placeholders for local and CI runs (supabase/functions/
 * local-dev.env). The functions refuse any "local-only" value unless
 * Supabase itself is local.
 */
export const FAKE_CRON_SECRET = "local-only-cron-secret";
export const FAKE_UNSUBSCRIBE_SECRET = "local-only-unsubscribe-secret-0000000000";

/**
 * A fake VAPID key pair for local and CI push. The private key is 32 bytes
 * of 0x01 (a valid P-256 key, obviously not a real one); the public key is
 * derived from it. The functions refuse this private key off a local Supabase.
 */
export const FAKE_VAPID_PRIVATE_KEY = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";
export const FAKE_VAPID_PUBLIC_KEY =
  "BG_wO5SSQc4drdQ1GeaWDgqFtBppoFwygQOqK84VlMoWPE91OlW_AdxT9sCwx-7ni0DG_30lqW4igrmJzvccFEo";

/** A valid env for parseEnv() and anything that needs one. */
export const fakeEnv = {
  NEXT_PUBLIC_SUPABASE_URL: FAKE_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: FAKE_PUBLISHABLE_KEY,
} as const;
