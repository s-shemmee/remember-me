/**
 * pnpm ai:index: builds Ask Noor's knowledge base and sends it to the
 * index-help Edge Function, which embeds only new or changed chunks.
 *
 * Sources: docs/help/*.md, plus the landing FAQ (its FAQPage JSON-LD),
 * /privacy and /terms, read from the site that matches the target
 * (src/ai/ask-noor/index-site.ts): --site=<url>, else SITE_URL, else the
 * production site for the cloud project and localhost for local Supabase.
 * Localhost is refused for the cloud project, and so is a site that doesn't
 * answer.
 *
 *   pnpm ai:index --dry-run                     # print the chunks, send nothing
 *   SUPABASE_URL=http://127.0.0.1:54321 AI_ADMIN_SECRET=… pnpm ai:index
 *
 * Prints only counts, the site and the target host, never the secret.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { chunkDoc, estimateTokens, type SourceDoc } from "../src/ai/ask-noor/chunk.ts";
import { indexSite, siteFlag } from "../src/ai/ask-noor/index-site.ts";
import { faqDoc, helpDoc, legalDoc } from "../src/ai/ask-noor/sources.ts";
import { HELP_SLUGS } from "../src/features/help/slugs.ts";

const root = path.resolve(import.meta.dirname, "..");
const dryRun = process.argv.includes("--dry-run");

function fail(message: string): never {
  console.error(`\nai:index: ${message}\n`);
  process.exit(1);
}

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/+$/, "");
const chosen = indexSite({
  flag: siteFlag(process.argv),
  siteUrl: process.env.SITE_URL,
  supabaseUrl,
});
if (!chosen.ok) fail(chosen.error);
const site = chosen.site;
console.log(
  `Site: ${site} (for ${supabaseUrl ? new URL(supabaseUrl).host : "a dry run with no Supabase target"}).`,
);

async function page(p: string): Promise<string> {
  const res = await fetch(`${site}${p}`, { signal: AbortSignal.timeout(20_000) }).catch(() =>
    fail(`${site}${p} didn't answer. Is the site running? Pass --site=<url> to read another one.`),
  );
  if (!res.ok) fail(`${site}${p} answered ${res.status}`);
  return res.text();
}

const docs: SourceDoc[] = HELP_SLUGS.map((slug) =>
  helpDoc(slug, readFileSync(path.join(root, "docs/help", `${slug}.md`), "utf8")),
);
docs.push(faqDoc(await page("/")));
docs.push(legalDoc("privacy", "Privacy Policy", "/privacy", await page("/privacy")));
docs.push(legalDoc("terms", "Terms of use", "/terms", await page("/terms")));
for (const d of docs)
  if (d.sections.length === 0) fail(`no sections found in ${d.source} (from ${site})`);

const chunks = docs.flatMap(chunkDoc);
const tokens = chunks.map((c) => estimateTokens(c.content));
console.log(`Read ${docs.length} documents from docs/help and ${site}.`);
console.log(
  `${chunks.length} chunks, about ${Math.min(...tokens)}–${Math.max(...tokens)} tokens each (average ${Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length)}).`,
);

if (dryRun) {
  for (const c of chunks)
    console.log(`  ${c.key.padEnd(48)} ${estimateTokens(c.content)} tokens  ${c.url}`);
  process.exit(0);
}

const secret = process.env.AI_ADMIN_SECRET;
if (!supabaseUrl) fail("set SUPABASE_URL (the project's URL, or http://127.0.0.1:54321 locally).");
if (!secret) fail("set AI_ADMIN_SECRET (the index-help function secret).");

// Small batches: embedding is slow and every request has a wall-clock limit.
const BATCH = 3;
type Reply = { embedded?: number; unchanged?: number; deleted?: number; error?: string };
async function send(payload: object): Promise<Reply> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${supabaseUrl}/functions/v1/index-help`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180_000),
    }).catch(() => null);
    const body = ((await res?.json().catch(() => ({}))) ?? {}) as Reply;
    if (res?.ok) return body;
    // A timeout may still have stored part of the batch; a retry skips those.
    if (attempt === 3)
      fail(`index-help answered ${res?.status ?? "nothing"} (${body.error ?? "no details"}).`);
  }
  return {};
}

console.log(
  `Sending to ${new URL(supabaseUrl).host}/functions/v1/index-help in batches of ${BATCH} …`,
);
const body = { embedded: 0, unchanged: 0, deleted: 0 };
for (let i = 0; i < chunks.length; i += BATCH) {
  const r = await send({ chunks: chunks.slice(i, i + BATCH) });
  body.embedded += r.embedded ?? 0;
  body.unchanged += r.unchanged ?? 0;
  process.stdout.write(`  ${Math.min(i + BATCH, chunks.length)}/${chunks.length}
`);
}
body.deleted = (await send({ keep: chunks.map((c) => c.key) })).deleted ?? 0;
console.log(
  `Done: ${body.embedded} embedded, ${body.unchanged} unchanged, ${body.deleted} deleted.`,
);
