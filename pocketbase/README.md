# PocketBase Backend

The PocketBase binary is **not** committed (gitignored). Version-controlled here are the JS hooks (`pb_hooks/`) and schema migrations (`pb_migrations/`).

## Local setup

1. Download the binary for your platform from the [PocketBase releases](https://github.com/pocketbase/pocketbase/releases) and place it at `pocketbase/pocketbase`.
2. Run it:

   ```bash
   just dev-pb
   ```

   This serves on `http://localhost:8090` using the local `pb_data/`, `pb_hooks/`, and `pb_migrations/` directories.

3. Open the admin UI at `http://localhost:8090/_/` to create the first admin account.

## Layout

- `pb_hooks/` — JavaScript business logic (currency math, threshold checks, ntfy triggers)
- `pb_migrations/` — schema as code; commit these so the data model is reproducible
- `pb_data/` — runtime database and files (gitignored)

## Test data

With the server running, `just seed` populates a "Test Family" household (parent,
two kids, chores, sample activity) via `seed.mjs` — idempotent, safe to re-run.
For a clean slate: stop the server, `just reset-db`, restart, then `just seed`.
All seeded logins use password `password123`.

## Production (future)

Deploy the same binary + `pb_hooks/` + `pb_migrations/` to the VPS. See `~/.windsurf/plans/choregalore-plan.md` and the audit-notifications memory for the self-hosting migration.
