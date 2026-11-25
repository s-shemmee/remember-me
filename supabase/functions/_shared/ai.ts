/**
 * Shared RAG provider calls for Noor (docs/ai.md):
 * - embed(): Supabase's built-in gte-small (384 dims, runs inside the Edge
 *   runtime, free). English-first: other languages match less well.
 * - generate(): Groq first, Cloudflare Workers AI as fallback. Both speak the
 *   OpenAI chat format, so plain fetch, no SDK. Models come from env. JSON mode.
 * Provider keys are server-side secrets and never browser-visible.
 */
import { secret } from "./env.ts";

type Message = { role: "system" | "user"; content: string };

const TIMEOUT_MS = 15_000;

/** gte-small, mean-pooled and normalised (cosine similarity = dot product). */
export async function embed(text: string): Promise<number[]> {
  const ai = (
    globalThis as {
      Supabase?: {
        ai?: {
          Session: new (model: string) => {
            run: (
              text: string,
              options: { mean_pool: boolean; normalize: boolean },
            ) => Promise<unknown>;
          };
        };
      };
    }
  ).Supabase?.ai;
  if (!ai) throw new Error("Supabase.ai isn't available in this runtime");
  const session = new ai.Session("gte-small");
  const output = await session.run(text, { mean_pool: true, normalize: true });
  return Array.from(output as ArrayLike<number>);
}

type Provider = { name: string; url: string; key: string; model: string };

function providers(): Provider[] {
  const list: Provider[] = [];
  const groq = Deno.env.get("GROQ_API_KEY");
  if (groq) {
    list.push({
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: groq,
      model: Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile",
    });
  }
  const cfAccount = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
  if (cfAccount && cfToken) {
    list.push({
      name: "cloudflare",
      url: `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1/chat/completions`,
      key: cfToken,
      model: Deno.env.get("CLOUDFLARE_MODEL") || "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    });
  }
  return list;
}

export type GenerateOptions = {
  /** Ask one provider only (the caller orders its own retries and fallback). */
  only?: "groq" | "cloudflare";
  temperature?: number;
  maxTokens?: number;
};

/** The model's raw reply: Groq, then Cloudflare. Throws when none answers. */
export async function generate(
  messages: Message[],
  { only, temperature = 0.2, maxTokens = 400 }: GenerateOptions = {},
): Promise<string> {
  const list = providers().filter((p) => !only || p.name === only);
  if (list.length === 0) throw new Error(`no AI provider configured${only ? ` (${only})` : ""}`);
  let lastError = "";
  for (const p of list) {
    try {
      const res = await fetch(p.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: p.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        lastError = `${p.name} ${res.status}`;
        continue;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
      lastError = `${p.name} empty`;
    } catch (e) {
      lastError = `${p.name} ${e instanceof Error ? e.name : "error"}`;
    }
  }
  throw new Error(`every provider failed (${lastError})`);
}

/** The admin secret for indexing and evals (never a user's call). */
export const aiAdminSecret = () => secret("AI_ADMIN_SECRET", 32);

export const intEnv = (name: string, fallback: number) => {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
