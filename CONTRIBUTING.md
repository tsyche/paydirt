# Contributing

Private family project — no external contributions. This file documents the dev workflow for future reference.

## Getting started

```bash
just setup        # install dependencies (one-time)
just fresh        # reset DB + seed + start everything (PB + web + Expo)
just stop         # stop all services
```

Run `just` with no arguments for a scenario cheat sheet. `just --list` shows all recipes.

## Tests

```bash
just test               # all unit tests (no server needed)
just test-integration   # live API/hook tests (needs running, seeded PB)
just test-e2e           # Playwright dashboard tests (needs running, seeded PB)
```

For live tests: `NTFY_DISABLED=1 just dev-pb`, then `just seed`.

For physical Android device testing, see [docs/DEVICE_TESTING.md](./docs/DEVICE_TESTING.md).

## Lint + typecheck

```bash
just lint
just typecheck
```

## Branches + commits

- Work on feature branches; merge to `main` when done.
- Commit messages: one concise line. No type prefixes (`feat:`, `fix:`, etc.).
- No `Co-Authored-By` trailers.

## Code style

- TypeScript everywhere (extensionless imports in `packages/shared`).
- No comments unless the *why* is non-obvious.
- Edit `AGENTS.md`, not `CLAUDE.md` — the PostToolUse hook syncs them.
