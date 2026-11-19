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

`pnpm db:stop` stops the stack (data is kept); `pnpm db:reset` rebuilds the local database from `supabase/migrations` (empty: run `pnpm seed:demo` for demo data).

### Environments

| | Supabase | Used by |
|---|---|---|
| Local | Docker (`pnpm db:start`) | day-to-day development and tests |
| Staging | the first cloud project (`eu-west-1`) | Vercel Preview deployments, testing in the cloud |
| Hosted deployment | Maintainer-managed; environment details omitted. |

Nothing in the code names a project: the URL and keys come from environment variables (Vercel: Production → production, Preview → staging). Migrations are written and tested locally, run in CI, then reach staging and production with `[maintainer-only command omitted]` (owner only, once CI is green; `supabase link` picks the project). Setting up production: [docs/launch.md](docs/launch.md).

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
| `pnpm db:reset` | Rebuild the local database from migrations (no data) |
| `pnpm seed:demo` | Demo accounts and data, local or staging only (see below) |
| `pnpm db:test` | pgTAP tests in `supabase/tests` against the local database |
| `pnpm db:types` | Regenerate `src/lib/supabase/types.ts` from the local database |

`pnpm lint`, `pnpm format:check`, `pnpm typecheck` and `pnpm test` must pass before any commit (`pnpm format` fixes formatting); `pnpm db:test` too when `supabase/` changed.

### Demo data (`pnpm seed:demo`)

Four demo accounts, all connected to each other, with realistic fictional data:

- **Maya** (the main one): 26 people (Moroccan and international names, every relation and colour), every kind of day (birthdays with and without a year, anniversaries, a graduation, a work milestone, a remembrance day, one person "In memory"), spread over the next 60 days, with some today, tomorrow and this week. Wishes on both lists (gift illustrations, never photos of people), some reserved by the others; birthday plans with ticked steps (one ticked by her own reservation); a sealed note to future her; reminders on, her own day included.
- **Amina, Badr and Sara**: connected to Maya and each other, with birthday wishlists, some reserved.

Every date is relative to today (Africa/Casablanca). Re-running deletes the previous demo accounts first (only accounts the seed created, marked `demo_seed` by the admin API) and starts clean.

**Local** (Docker running):

```bash
pnpm db:start
pnpm seed:demo
```

It reads the local keys from `supabase status` and prints the four addresses. The password is `local-only-demo-password-0000` (local only).

**Staging** (never production): name the staging project explicitly, and give a password and keys:

```bash
SUPABASE_URL=https://<staging ref>.supabase.co SUPABASE_STAGING_REF=<staging ref> SUPABASE_SECRET_KEY=<staging secret key> SUPABASE_PUBLISHABLE_KEY=<staging publishable key> SEED_DEMO_PASSWORD=<12+ characters> SEED_DEMO_EMAIL='you+demo-{name}@gmail.com' pnpm seed:demo
```

`SEED_DEMO_EMAIL` (default `demo.{name}@remember-me.test`) sets the addresses; on staging, use plus-addresses of an inbox you read, so the demo reminder emails land somewhere instead of bouncing.

The seed guard permits local Supabase URLs only and refuses remote targets before writes.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS v4 with our design tokens, shadcn/ui on Radix, Supabase (Auth, Postgres with RLS), Sentry, Vitest + Testing Library, pgTAP, GitHub Actions, Vercel. See [`AGENTS.md`](AGENTS.md) for the full stack and rules.

```
[Repository structure omitted from this historical README.]
```