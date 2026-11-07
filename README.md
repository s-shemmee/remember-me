# Remember Me

A gentle web app (PWA first) for remembering the people you love: their birthdays and special days, their wishlists, and your own day too. Noor, a little birthday candle, is the in-app assistant.

Start with [`AGENTS.md`](AGENTS.md) and [`docs/decisions.md`](docs/decisions.md). Product, design, data, AI and quality docs live in [`docs/`](docs/).

## Getting started

You need Node 22+ (24 in CI), pnpm (version pinned in `package.json`; run `corepack enable` once) and **Docker Desktop** for the local Supabase stack.

```bash
pnpm install
pnpm db:start        # local Supabase in Docker: Postgres, Auth, Studio, Mailpit
```

`pnpm db:start` prints the local URLs and keys. Put the local ones in `.env.local` (see `.env.example` for the names):

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # "Publishable" from `pnpm db:start` / `pnpm exec supabase status`
```

Then run the app:

```bash
pnpm dev
```

| What | Where |
|---|---|
| App | [http://localhost:3000](http://localhost:3000) |
| Supabase Studio (browse the local database) | [http://127.0.0.1:54323](http://127.0.0.1:54323) |
| Mailpit (every email the app sends locally: sign-up confirmation, password reset) | [http://127.0.0.1:54324](http://127.0.0.1:54324) |
| Health check | [http://localhost:3000/api/health](http://localhost:3000/api/health) |

Local email never leaves your machine: sign up with any address, then open Mailpit to click the link. Google sign-in is off locally; test it on a Vercel preview.

`pnpm db:stop` stops the stack (data is kept); `pnpm db:reset` rebuilds the local database from `supabase/migrations` and `supabase/seed.sql`.

### Environments

| | Supabase | Used by |
|---|---|---|
| Local | Docker (`pnpm db:start`) | day-to-day development and tests |
| Cloud project | `[project reference removed]` | Vercel previews and production |

Migrations are written and tested locally, run in CI, and reach the cloud with `[maintainer-only command omitted]` (owner only, once CI is green).

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the app locally |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, `strict` |
| `pnpm test` | Vitest (unit + component) |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm db:start` / `pnpm db:stop` | Start / stop local Supabase (Docker) |
| `pnpm db:reset` | Rebuild the local database from migrations and seed |
| `pnpm db:test` | pgTAP tests in `supabase/tests` against the local database |
| `pnpm db:types` | Regenerate `src/lib/supabase/types.ts` from the local database |

`pnpm lint`, `pnpm typecheck` and `pnpm test` must pass before any commit; `pnpm db:test` too when `supabase/` changed.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS v4 with our design tokens, shadcn/ui on Radix, Supabase (Auth, Postgres with RLS), Sentry, Vitest + Testing Library, pgTAP, GitHub Actions, Vercel. See [`AGENTS.md`](AGENTS.md) for the full stack and rules.

```
[Repository structure omitted from this historical README.]
```