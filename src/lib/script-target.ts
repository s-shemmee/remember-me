/**
 * Which Supabase project `pnpm ai:index` and `pnpm ai:eval` talk to, the same
 * way as `supabase db push`: local Supabase unless you name the cloud project.
 *
 *   pnpm ai:index                         # local (http://127.0.0.1:54321)
 *   pnpm ai:index --remote=<project-ref>  # that cloud project
 *
 * A bare `--remote` is refused (the repo never runs a cloud command without
 * naming the project), and so is an empty one (`--remote=$UNSET`). There's
 * no fallback to SUPABASE_URL or .env.local: a cloud URL found there, with
 * no --remote, is refused instead of used. Pure (relative .ts imports only):
 * the scripts and Vitest share it.
 */
import { FAKE_AI_ADMIN_SECRET } from "../test/fake-values.ts";

export const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";

/** The local placeholder; refused for the cloud. */
export const LOCAL_AI_ADMIN_SECRET = FAKE_AI_ADMIN_SECRET;

export type ScriptTarget =
  | { ok: true; remote: false; url: string; label: string }
  | { ok: true; remote: true; ref: string; url: string; label: string }
  | { ok: false; error: string };

const isLocalHost = (url: string) => {
  try {
    return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
};

/**
 * From the command line (and SUPABASE_URL, only to refuse a cloud one that
 * came without --remote).
 */
export function scriptTarget(
  argv: readonly string[],
  env: { SUPABASE_URL?: string } = {},
): ScriptTarget {
  const flag = argv.find((a) => a === "--remote" || a.startsWith("--remote="));
  if (flag === undefined) {
    const fromEnv = env.SUPABASE_URL?.trim();
    if (fromEnv && !isLocalHost(fromEnv)) {
      return {
        ok: false,
        error:
          `SUPABASE_URL points to ${new URL(fromEnv).host}, but cloud projects are only used with ` +
          `--remote=<project-ref>. Pass --remote="\${SUPABASE_PROJECT_REF:?}" instead.`,
      };
    }
    return { ok: true, remote: false, url: LOCAL_SUPABASE_URL, label: "local Supabase" };
  }
  if (flag === "--remote") {
    return {
      ok: false,
      error:
        'Name the project: --remote="${SUPABASE_PROJECT_REF:?}" (a bare --remote is never used here).',
    };
  }
  const ref = flag.slice("--remote=".length).trim();
  if (!ref) {
    return {
      ok: false,
      error: "--remote= is empty. Export SUPABASE_PROJECT_REF first, or type the project ref.",
    };
  }
  if (!/^[a-z]{20}$/.test(ref)) {
    return { ok: false, error: `"${ref}" isn't a Supabase project ref (20 lowercase letters).` };
  }
  return {
    ok: true,
    remote: true,
    ref,
    url: `https://${ref}.supabase.co`,
    label: `project ${ref} (cloud)`,
  };
}

/**
 * The admin secret for that target: required for a cloud project (and never
 * the local placeholder); locally the placeholder unless you set one.
 */
export function adminSecretFor(
  target: Extract<ScriptTarget, { ok: true }>,
  secret: string | undefined,
): { ok: true; secret: string } | { ok: false; error: string } {
  const s = secret?.trim();
  if (target.remote) {
    if (!s) {
      return {
        ok: false,
        error:
          "Set AI_ADMIN_SECRET (read -rs AI_ADMIN_SECRET, then paste it) for the cloud project.",
      };
    }
    if (s.startsWith("local-only")) {
      return { ok: false, error: "That's the local placeholder secret, not the cloud project's." };
    }
    return { ok: true, secret: s };
  }
  return { ok: true, secret: s || LOCAL_AI_ADMIN_SECRET };
}

/** The command line without flags: `pnpm ai:eval ask-noor --remote=…` → ["ask-noor"]. */
export const positionalArgs = (argv: readonly string[]) => argv.filter((a) => !a.startsWith("--"));
