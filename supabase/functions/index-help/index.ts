/**
 * index-help: stores Ask Noor's knowledge base (help_chunks). Called only by
 * `pnpm ai:index` with AI_ADMIN_SECRET, in small batches (embedding is slow,
 * and a request has a wall-clock limit): each batch's new or changed chunks
 * are embedded with gte-small and stored; unchanged ones are skipped. The
 * last call sends `keep`, every current key, and chunks not in it are
 * deleted. Public product text only.
 */
import { z } from "zod";

import { aiAdminSecret, embed } from "../_shared/ai.ts";
import { json, safeEqual } from "../_shared/env.ts";
import { adminClient } from "../_shared/reminders.ts";

const chunkSchema = z.object({
  key: z.string().min(3).max(200),
  source: z.string().min(2).max(80),
  title: z.string().min(1).max(120),
  heading: z.string().min(1).max(300),
  url: z.string().regex(/^\/[A-Za-z0-9/_#-]*$/),
  content: z.string().min(1).max(4000),
  hash: z.string().regex(/^[0-9a-f]{16}$/),
});
const bodySchema = z.object({
  chunks: z.array(chunkSchema).max(10).default([]),
  keep: z.array(z.string().min(3).max(200)).min(1).max(5000).optional(),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  let allowed = false;
  try {
    allowed = token !== "" && safeEqual(token, aiAdminSecret());
  } catch {
    allowed = false;
  }
  if (!allowed) return json({ error: "unauthorized" }, 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_body" }, 400);
  const { chunks, keep } = parsed.data;

  try {
    const db = adminClient();
    const { data: existing, error } = await db.from("help_chunks").select("key, content_hash");
    if (error) throw new Error(error.message);
    const known = new Map((existing ?? []).map((r) => [r.key as string, r.content_hash as string]));

    let embedded = 0;
    for (const c of chunks) {
      if (known.get(c.key) === c.hash) continue;
      const embedding = await embed(c.content);
      const { error: upsertError } = await db.from("help_chunks").upsert({
        key: c.key,
        source: c.source,
        title: c.title,
        heading: c.heading,
        url: c.url,
        content: c.content,
        content_hash: c.hash,
        embedding: JSON.stringify(embedding),
        updated_at: new Date().toISOString(),
      });
      if (upsertError) throw new Error(upsertError.message);
      embedded++;
    }

    // The last call lists every current key: anything else is gone from the sources.
    const keepSet = keep ? new Set(keep) : null;
    const stale = keepSet ? [...known.keys()].filter((k) => !keepSet.has(k)) : [];
    if (stale.length) {
      const { error: deleteError } = await db.from("help_chunks").delete().in("key", stale);
      if (deleteError) throw new Error(deleteError.message);
    }
    return json({ ok: true, embedded, unchanged: chunks.length - embedded, deleted: stale.length });
  } catch (error) {
    console.error(
      "index-help failed:",
      error instanceof Error ? error.message.slice(0, 160) : "unknown",
    );
    return json({ error: "failed" }, 500);
  }
});
