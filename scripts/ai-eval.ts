/**
 * pnpm ai:eval: runs the AI evals against the real Edge Functions and
 * providers, and prints a pass rate per suite. Never in CI (it calls real AI
 * providers). Both suites by default, or one: `pnpm ai:eval gift-ideas`.
 *
 * Like `supabase db push`, local Supabase unless you name the cloud project
 * (src/lib/script-target.ts):
 *
 *   pnpm ai:eval                                             # local Supabase
 *   read -rs AI_ADMIN_SECRET
 *   AI_ADMIN_SECRET="$AI_ADMIN_SECRET" pnpm ai:eval gift-ideas --remote="${SUPABASE_PROJECT_REF:?}"
 *
 * Ask Noor (docs/ai/evals/ask-noor.json): a case passes when Noor answers and
 * cites a source starting with expectedSource, or, for expectedSource null,
 * when she refuses.
 * Gift ideas (docs/ai/evals/gift-ideas.json, fictional people): 3 to 5 ideas,
 * within the length limits, no prices or links, and at least one idea
 * mentions one of their little things.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  hasPriceOrLink,
  mentionsALittleThing,
  TITLE_MAX,
  WHY_MAX,
} from "../src/ai/gift-ideas/ideas.ts";
import { adminSecretFor, positionalArgs, scriptTarget } from "../src/lib/script-target.ts";

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
const supabaseUrl = target.url;
const secretFor = adminSecretFor(target, process.env.AI_ADMIN_SECRET);
if (!secretFor.ok) fail(secretFor.error);
const secret = secretFor.secret;
console.log(`Target: ${target.label}.`);

const only = positionalArgs(process.argv.slice(2))[0];
const rates: boolean[] = [];

async function askNoorSuite() {
  const { cases } = JSON.parse(
    readFileSync(path.join(root, "docs/ai/evals/ask-noor.json"), "utf8"),
  ) as {
    cases: Case[];
  };
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
  console.log(`\n${passed}/${cases.length} passed (${rate}%).\n`);
  rates.push(rate >= 80);
}

type GiftCase = {
  name: string;
  relationKind: string | null;
  occasion: string;
  budget: string | null;
  littleThings: string[];
  wishes: string[];
};
type GiftResult =
  | { kind: "ideas"; ideas: { title: string; why: string }[] }
  | { kind: "unavailable" }
  | { error: string };

async function giftIdeasSuite() {
  const { cases } = JSON.parse(
    readFileSync(path.join(root, "docs/ai/evals/gift-ideas.json"), "utf8"),
  ) as { cases: GiftCase[] };
  let passed = 0;
  console.log(`Gift ideas evals: ${cases.length} fictional people\n`);
  for (const c of cases) {
    const started = performance.now();
    const { budget, ...person } = c;
    const res = await fetch(`${supabaseUrl}/functions/v1/gift-ideas`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ person, budget }),
      signal: AbortSignal.timeout(90_000),
    });
    const r = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as GiftResult;
    const ms = Math.round(performance.now() - started);
    const problems: string[] = [];
    if ("error" in r) problems.push(`error ${r.error}`);
    else if (r.kind !== "ideas") problems.push(r.kind);
    else {
      const n = r.ideas.length;
      if (n < 3 || n > 5) problems.push(`${n} ideas`);
      if (r.ideas.some((i) => i.title.length > TITLE_MAX || i.why.length > WHY_MAX)) {
        problems.push("too long");
      }
      if (r.ideas.some((i) => hasPriceOrLink(`${i.title} ${i.why}`))) {
        problems.push("a price or link");
      }
      if (!mentionsALittleThing(r.ideas, c.littleThings)) problems.push("no little thing");
    }
    const ok = problems.length === 0;
    if (ok) passed++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${c.name} (${c.occasion}${budget ? `, ${budget}` : ""}) · ${ms} ms` +
        (ok ? "" : `\n      ${problems.join(", ")}`),
    );
  }
  const rate = Math.round((passed / cases.length) * 100);
  console.log(`\n${passed}/${cases.length} passed (${rate}%).\n`);
  rates.push(rate >= 80);
}

if (!only || only === "ask-noor") await askNoorSuite();
if (!only || only === "gift-ideas") await giftIdeasSuite();
process.exit(rates.length > 0 && rates.every(Boolean) ? 0 : 1);
