# Contributing

Thank you for helping make Remember Me better. Bug reports, thoughtful feature ideas, documentation fixes, and code contributions are welcome.

## Before you start

- Read the [README](README.md) and [design system](docs/design/DESIGN.md).
- Search existing issues and pull requests before starting substantial work.
- For a large change, open an issue first so we can agree on the approach.
- Keep personal data and real credentials out of issues, tests, screenshots, and commits.

## Local development

Follow the [local setup guide](README.md#run-it-locally). The demo seed is restricted to local Supabase. Do not point it or automated tests at a hosted database.

Useful checks:

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

For database changes, add a new SQL migration and focused pgTAP tests, then run `pnpm db:test` against local Supabase. Never edit an already-merged migration. For user-facing changes, add or update Playwright tests where appropriate and check both themes at phone and desktop sizes.

## Pull requests

- Keep changes focused and explain the user-visible reason.
- Add tests for changed behavior and update directly related documentation.
- Use a clear conventional commit subject, such as `fix(calendar): handle leap-day reminders`.
- Do not add a dependency without explaining why.
- Do not include generated tool credits or co-author trailers.
- Never include secrets, production data, or screenshots containing personal information.

## Privacy and security

RLS policies must protect every table. The owner of a wishlist must never learn who reserved a gift. AI output must be validated, and AI suggestions must not be saved without the user's confirmation. Report security issues privately as described in [SECURITY.md](SECURITY.md).
