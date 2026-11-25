/**
 * Runs the Ask Noor evals against a local Supabase Edge Function. Never run in
 * CI: the function uses a configured provider.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { adminSecretFor, scriptTarget } from "../src/lib/script-target.ts";

type Case = { question: string; expectedSource: string | null };
type Result =
  | { kind: "answer"; answer: string; sources: { url: string }[] }
  | { kind: "out_of_scope" }
  | { kind: "unsure" }
  | { error: string };

const root = path.resolve(import.meta.dirname, "..");
function fail(message: string): never {
  console.error(`\nai:eval: ${message}\n`);
  process.exit(1);
}

const target = scriptTarget(process.argv, { SUPABASE_URL: process.env.SUPABASE_URL });
if (!target.ok) fail(target.error);
const secretFor = adminSecretFor(target, process.env.AI_ADMIN_SECRET);
if (!secretFor.ok) fail(secretFor.error);
console.log(`Target: ${target.label}.`);

const { cases } = JSON.parse(
  readFileSync(path.join(root, "docs/ai/evals/ask-noor.json"), "utf8"),
) as { cases: Case[] };
let passed = 0;
console.log(`Ask Noor evals: ${cases.length} cases against ${new URL(target.url).host}\n`);

for (const testCase of cases) {
  const started = performance.now();
  const response = await fetch(`${target.url}/functions/v1/ask-noor`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretFor.secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question: testCase.question }),
    signal: AbortSignal.timeout(60_000),
  });
  const result = (await response
    .json()
    .catch(() => ({ error: `HTTP ${response.status}` }))) as Result;
  const ms = Math.round(performance.now() - started);
  let ok: boolean;
  let got: string;

  if ("error" in result) {
    ok = false;
    got = `error ${result.error}`;
  } else if (result.kind === "answer") {
    const urls = result.sources.map((source) => source.url);
    ok =
      testCase.expectedSource !== null &&
      urls.some((url) => url.startsWith(testCase.expectedSource!));
    got = `answer (${urls.join(", ")})`;
  } else {
    ok = testCase.expectedSource === null;
    got = result.kind;
  }

  if (ok) passed++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${testCase.question}\n      want ${testCase.expectedSource ?? "a refusal"}, got ${got} · ${ms} ms`,
  );
}

const rate = Math.round((passed / cases.length) * 100);
console.log(`\n${passed}/${cases.length} passed (${rate}%).\n`);
process.exit(rate >= 80 ? 0 : 1);
