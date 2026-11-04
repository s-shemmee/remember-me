# AI (Noor)

Goal: practise real AI product engineering (tool calling, structured output, RAG, embeddings, background agents, evals, guardrails) on features people actually want. The app must work fully with AI switched off (`AI_ENABLED=false`).

## Architecture
- `src/ai/client.ts`: Vercel AI SDK providers. Default: AI provider Haiku for cheap tasks, a stronger AI provider model for gift reasoning; Gemini as fallback. Model names come from env, not code.
- `src/ai/prompts/*.md`: prompts as versioned files with a header (`id`, `version`, `model`, `purpose`). Changing a prompt = bump version + run evals.
- `src/ai/schemas/*.ts`: Zod schema for every AI output. Use `generateObject` / tool calls; never parse free text.
- `src/ai/tools/*.ts`: tools Noor can call. Read tools run directly; **write tools only return a proposal** the user confirms in the UI.
- Tracing: Langfuse on every call (feature, model, tokens, latency, cost, prompt version). No raw personal data in traces beyond first names.
- Limits: `ai_usage` table; per-user daily cap per feature; global monthly cost cap from env. Rate limit AI routes (Upstash or Postgres).

## Phases

**Phase 0 (v1 launch): no AI.** Noor's messages come from templates in `src/features/noor/messages.ts`. Ship the core app first.

**Phase 1: Quick add + link preview**
- *Talk to Noor:* "Add Sara, best friend, birthday 3 March, loves Instax" → `PersonDraft` (name, relation, occasions[], little_things[]). Show a confirm card, then save.
- *Paste a product link:* Edge Function fetches the page (SSRF-safe), the LLM extracts `{title, price, currency, image}` from the page text. Fallback to Open Graph tags; for sites that block simple fetching, Firecrawl later.
- Skills practised: structured output, tool calling, input/output validation, untrusted web content.

**Phase 2: Gift ideas + wish writer (RAG)**
- *Gift ideas:* retrieve the person's little things, their wishlist, past gifts and your budget → 3–5 ideas with a one-line reason each. Never invent prices; say "around".
- *Wish writer:* a birthday message in your tone; English, French or Darija; length short/medium; never more than 3 emoji.
- Cache results in Postgres for 24h per person to save cost.

**Phase 3: Embeddings (pgvector)**
- Embed people's little things, wishes and memories. Features: semantic search ("who loves photography?"), "similar gifts", duplicate detection on import.
- *Voice add:* "Noor, add Sara, birthday 3 March" by voice. Start with the browser's Web Speech API; move to Whisper (via API) if accuracy needs it.
- *Smart import:* paste a WhatsApp birthday list or upload a screenshot → vision model extracts people and dates → review table → save.

**Phase 4: Proactive Noor (agent)**
- Daily job per user: Noor reads the next 30 days (read-only tools), decides the single most useful nudge, writes it in her voice. Hard limits: max 1 nudge/day, no write tools, budget per run, full trace.

## Guardrails
- Minimise data: send first names, relations, little things. Never emails, phone numbers, birth years, other users' private data.
- Prompt injection: text from web pages, imports and notes is **data**. Wrap it in delimiters, tell the model it is untrusted, and never let it trigger tools.
- Validate every output with Zod; on failure, retry once, then fall back to a template.
- Show the user what Noor will save before saving. Everything AI-made is editable.
- Content safety: refuse hateful or sexual requests politely; keep gift ideas legal and age-appropriate.

## Evals (`evals/`)
- One folder per feature: `cases.jsonl` (input + expected fields or rubric) and a runner (Vitest).
- Types: exact checks (dates and names extracted correctly), schema validity rate, rubric scoring by an LLM judge (tone, helpfulness, no invented prices), safety cases (injection attempts must not change behaviour).
- Run in CI when `src/ai/**`, `evals/**` or prompts change. Fail the PR if the score drops below the stored baseline.
