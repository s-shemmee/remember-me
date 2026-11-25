import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CONTACT_EMAIL, CONTACT_MAILTO } from "./contact";

/**
 * One contact address everywhere: the app, landing, emails, auth templates,
 * Edge Functions, docs, README and .env.example. Only CONTACT_EMAIL may
 * appear; hello@ never does.
 * Failures name the file and the address only, nothing else from the file.
 */
const ROOT = path.resolve(__dirname, "../..");
const ALLOWED = new Set([CONTACT_EMAIL]);
const PLACES = [
  "src",
  "supabase/templates",
  "supabase/functions",
  "docs",
  "e2e",
  "README.md",
  ".env.example",
  "AGENTS.md",
];
const ADDRESS = /[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)*shemme\.codes|hello@[a-z0-9.-]+/gi;

function files(p: string): string[] {
  const full = path.join(ROOT, p);
  if (!existsSync(full)) return [];
  if (statSync(full).isFile()) return [full];
  return readdirSync(full, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? files(path.join(p, d.name))
      : /\.(tsx?|html|md|sql|toml)$/.test(d.name) || d.name.startsWith(".env")
        ? [path.join(full, d.name)]
        : [],
  );
}

describe("contact address", () => {
  it("is contact@shemme.codes", () => {
    expect(CONTACT_EMAIL).toBe("contact@shemme.codes");
    expect(CONTACT_MAILTO).toBe("mailto:contact@shemme.codes");
  });

  it("no other address (and never hello@) anywhere in the repo", () => {
    const found = PLACES.flatMap(files).flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(ADDRESS)]
        .map((m) => m[0].toLowerCase())
        .filter((a) => !ALLOWED.has(a))
        .map((a) => `${path.relative(ROOT, f)}: ${a}`),
    );
    expect(found).toEqual([]);
  });

  it("the auth templates' footer uses it", () => {
    for (const name of ["confirm-signup", "magic-link", "reset-password", "change-email"]) {
      const html = readFileSync(path.join(ROOT, "supabase/templates", `${name}.html`), "utf8");
      expect(html, name).toContain(`href="${CONTACT_MAILTO}"`);
    }
  });
});
