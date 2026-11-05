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

/** A valid env for parseEnv() and anything that needs one. */
export const fakeEnv = {
  NEXT_PUBLIC_SUPABASE_URL: FAKE_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: FAKE_PUBLISHABLE_KEY,
} as const;
