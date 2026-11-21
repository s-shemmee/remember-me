import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `supabase functions deploy` (CLI 3) finds imports with this regex, copied
 * from the CLI. It also matches an exported string on one line, such as
 * `export const X = "/email/logo.png"`, reads it as an absolute import, and
 * warns "Skipping import path outside source root" for every function.
 * This follows each function's imports (into src/ too) and checks that no
 * bundled file has a match like that.
 */
const CLI_IMPORT =
  /(?:import|export)\s+(?:type\s+)?(?:{[^{}]+}|.*?)\s*(?:from)?\s*['"](.*?)['"]|import\(\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)')\s*[,)]/gi;

const specifiers = (file: string) =>
  [...readFileSync(file, "utf8").matchAll(CLI_IMPORT)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");

/** Every file one function bundles, following relative imports. */
function bundled(entry: string): string[] {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    for (const spec of specifiers(file)) {
      if (spec.startsWith("./") || spec.startsWith("../")) visit(join(dirname(file), spec));
    }
  };
  visit(entry);
  return [...seen];
}

const FUNCTIONS = readdirSync("supabase/functions", { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => join("supabase/functions", d.name, "index.ts"))
  .filter(existsSync);

describe("Edge Function bundles", () => {
  it("finds the functions and follows them into src/", () => {
    expect(FUNCTIONS.length).toBeGreaterThan(5);
    const all = FUNCTIONS.flatMap(bundled).map((f) => relative(".", f).replaceAll("\\", "/"));
    expect(all).toContain("src/features/reminders/email.tsx");
  });

  it.each(FUNCTIONS)("%s: no absolute path the deploy would skip with a warning", (entry) => {
    const absolute = bundled(entry).flatMap((file) =>
      specifiers(file)
        .filter((spec) => spec.startsWith("/"))
        .map((spec) => `${relative(".", file)}: ${spec}`),
    );
    expect(absolute).toEqual([]);
  });
});
