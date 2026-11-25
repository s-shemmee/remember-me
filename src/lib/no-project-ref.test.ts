import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The code and docs must not contain a hard-coded Supabase project URL or
 * project reference. Connection details come from environment variables.
 * Test fakes (test.supabase.co, project.supabase.co) are fine.
 */
const ROOT = path.resolve(__dirname, "../..");
const PLACES = [
  "src",
  "supabase/functions",
  "supabase/migrations",
  "supabase/templates",
  "supabase/config.toml",
  "scripts",
  "e2e",
  "docs",
  ".github",
  "README.md",
  "AGENTS.md",
  "next.config.ts",
  "vercel.json",
];
const SKIP_DIRS = new Set(["node_modules", ".next", "design"]);

// A real project ref is 20 lowercase letters.
const PATTERNS = [
  /\b[a-z]{20}\.supabase\.(co|in)\b/g,
  /supabase\.com\/dashboard\/project\/[a-z]{20}\b/g,
  /\bpostgres\.[a-z]{20}\b/g,
  /project[-_]?ref["'=:\s]+[a-z]{20}\b/gi,
  /`[a-z]{20}`/g,
];

function files(p: string): string[] {
  const full = path.join(ROOT, p);
  if (!existsSync(full)) return [];
  if (statSync(full).isFile()) return [full];
  return readdirSync(full, { withFileTypes: true }).flatMap((d) => {
    if (d.isDirectory()) return SKIP_DIRS.has(d.name) ? [] : files(path.join(p, d.name));
    return /\.(tsx?|mjs|js|json|toml|sql|html|md|ya?ml|env)$/.test(d.name)
      ? [path.join(full, d.name)]
      : [];
  });
}

describe("no hard-coded Supabase project", () => {
  it("names no project ref or project URL in code, config or docs", () => {
    const found = PLACES.flatMap(files).flatMap((f) => {
      if (f.endsWith(path.join("lib", "no-project-ref.test.ts"))) return [];
      const text = readFileSync(f, "utf8");
      return PATTERNS.flatMap((re) =>
        [...text.matchAll(re)].map((m) => `${path.relative(ROOT, f)}: ${m[0]}`),
      );
    });
    expect(found).toEqual([]);
  });

  it("the app reads the project from env variables", () => {
    const env = readFileSync(path.join(ROOT, "src/lib/env.ts"), "utf8");
    expect(env).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(env).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });
});
