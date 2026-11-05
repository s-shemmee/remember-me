# Remember Me

A gentle web app (PWA first) for remembering the people you love: their birthdays and special days, their wishlists, and your own day too. Noor, a little birthday candle, is the in-app assistant.

Start with [`AGENTS.md`](AGENTS.md) and [`docs/decisions.md`](docs/decisions.md). Product, design, data, AI and quality docs live in [`docs/`](docs/).

## Getting started

Requires Node 22+ and pnpm (the version is pinned in `package.json` via `packageManager`; run `corepack enable` once).

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). For now `/` is a temporary page showing the design tokens and fonts in light and dark.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the app locally |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, `strict` |
| `pnpm test` | Vitest (unit + component) |
| `pnpm format` / `pnpm format:check` | Prettier |

`pnpm lint`, `pnpm typecheck` and `pnpm test` must pass before any commit.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS v4 with our design tokens, Vitest + Testing Library. Supabase, Playwright, CI and Vercel are added next as part of milestone M0 (see [`docs/roadmap.md`](docs/roadmap.md)).
