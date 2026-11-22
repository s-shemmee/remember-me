# Guide for AI coding agents

Before any change, read:
1. `AGENTS.md`: stack, commands, conventions, security rules (applies to every agent, not only one tool).
2. `docs/design/DESIGN.md`: visual system, header order, layouts, emoji rule, Noor's voice.
3. `docs/roadmap/README.md`: what's next and in what order.

Hard rules (never break):
- Do not perform hosted deployments during development; use local and test resources.
- Migrations are SQL only and never edited after merge; add a new one. Every table has RLS with explicit policies; no `service_role` key in the browser, ever.
- Never read, print or edit `.env*` files; never commit secrets or real keys. Public values only in `NEXT_PUBLIC_*`. Fake test values go in `src/test/fake-values.ts` and `.gitleaks.toml`.
- Every Server Action checks the user, validates input with Zod and returns typed results. Never trust the client.
- AI features: free providers only, behind feature flags, `AI_MOCK=1` in tests, usage capped via `claim_ai_use()`. AI output is Zod-validated, and AI never writes to the database without the user confirming.
- Never reveal who reserved a gift, anywhere (UI, API, notifications, logs).
- Dates: occasions are `day` + `month` (+ optional `year`); next occurrence in the user's timezone with `src/lib/dates.ts`; handle 29 February.
- One branch per task from `main`; conventional commits; no force pushes; don't amend pushed commits.
- Fix the pattern, not just the instance: search the whole repo for the same cause and fix every occurrence in the same PR.
- Keep deployment credentials and environments maintainer-managed.
- `seed:demo` is local only.
- No new dependency outside the stack without saying why in the PR.
- No AI-tool names or co-author trailers in code, comments, docs or commits.
- UI: follow `docs/design/DESIGN.md`. WCAG 2.2 AA (4.5:1 text, visible focus, 44px targets, labels on every field, real buttons and links). Lucide icons for controls (nav, buttons, menus, Settings, form controls, toasts); emoji for content and feeling (stat tiles, plan steps, occasion types, Noor, user content), `aria-hidden` next to text. The rule: DESIGN.md "Icons and emoji". Dark mode, reduced motion, axe clean. Copy: short, warm, plain English, no em dashes; Noor speaks in first person, one emoji max.
- Keep CI green: lint, typecheck, format:check, unit, pgTAP, Playwright + axe, Lighthouse CI, gitleaks. Before calling a task done: lint, typecheck, tests, and for UI a look in light and dark at 390px and 1440px.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
