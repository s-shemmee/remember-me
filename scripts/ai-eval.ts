/**
 * pnpm ai:eval: runs the Ask Noor evals (docs/ai/evals/ask-noor.json)
 * against the real ask-noor function and providers, and prints a pass rate.
 * Never in CI (it calls real AI providers).
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 AI_ADMIN_SECRET=… pnpm ai:eval
 *
 * A case passes when Noor answers and cites a source starting with
 * expectedSource, or, for expectedSource null, when she refuses.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

type Case = { question: string; expectedSource: string | null };
type Result =
  | { kind: "answer"; answer: string; sources: { url: string }[] }
  | { kind: "out_of_scope" }
  | { kind: "unsure" }
  | { error: string };

const root = path.resolve(import.meta.dirname, "..");
const { cases } = JSON.parse(
  readFileSync(path.join(root, "docs/ai/evals/ask-noor.json"), "utf8"),
) as {
  cases: Case[];
};
const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/+$/, "");
const secret = process.env.AI_ADMIN_SECRET;
if (!supabaseUrl || !secret) {
  console.error("\nai:eval: set SUPABASE_URL and AI_ADMIN_SECRET.\n");
  process.exit(1);
}

let passed = 0;
console.log(`Ask Noor evals: ${cases.length} cases against ${new URL(supabaseUrl).host}\n`);
for (const c of cases) {
  const started = performance.now();
  const res = await fetch(`${supabaseUrl}/functions/v1/ask-noor`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ question: c.question }),
    signal: AbortSignal.timeout(60_000),
  });
  const r = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as Result;
  const ms = Math.round(performance.now() - started);
  let ok: boolean;
  let got: string;
  if ("error" in r) {
    ok = false;
    got = `error ${r.error}`;
  } else if (r.kind === "answer") {
    const urls = r.sources.map((s) => s.url);
    ok = c.expectedSource !== null && urls.some((u) => u.startsWith(c.expectedSource!));
    got = `answer (${urls.join(", ")})`;
  } else {
    ok = c.expectedSource === null;
    got = r.kind;
  }
  if (ok) passed++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${c.question}\n      want ${c.expectedSource ?? "a refusal"}, got ${got} · ${ms} ms`,
  );
}
const rate = Math.round((passed / cases.length) * 100);
console.log(`\n${passed}/${cases.length} passed (${rate}%).`);
process.exit(rate >= 80 ? 0 : 1);
