# PayDirt

*Do. The. Thing.*

A private family chore tracking app. Parents assign chores; kids complete them on Android devices and mark them done; parents approve. Rewards are virtual currency (**parentBucks**) that kids spend on screen time (manually granted), bank toward thresholds, or exchange for physical goods. Family-only — not a public app.

## Tech Stack

- **apps/web** — Next.js parent dashboard
- **apps/mobile** — Expo (React Native) + react-native-paper (Material Design 3); single binary, role-gated parent/kid views; no Google Play Services dependency (runs on GrapheneOS / LineageOS)
- **packages/shared** — shared TypeScript types, API clients, business logic, validation
- **pocketbase/** — PocketBase backend (auth, SQLite, real-time, file storage, JS hooks for business logic). Binary downloaded separately; `pb_hooks/` and `pb_migrations/` are version-controlled
- **ntfy** — all push notifications (no FCM); public ntfy.sh for now, self-hosted on VPS later

## Project Structure

```
paydirt/
  apps/
    web/            # Next.js parent dashboard
    mobile/         # Expo RN — parent + kid views
  packages/
    shared/         # types, API clients, business logic
  pocketbase/
    pb_hooks/       # JS business logic (currency math, threshold checks)
    pb_migrations/  # schema as code
  docs/             # architecture, troubleshooting, etc.
```

## Development

```bash
make setup        # install workspace deps (pnpm)
make dev-web      # Next.js dashboard
make dev-mobile   # Expo app
make dev-pb       # local PocketBase (needs binary in pocketbase/)
make seed         # seed test household/users/chores (server must be RUNNING)
make reset-db     # wipe + rebuild empty DB (server must be STOPPED)
make test         # all workspace tests
make lint         # lint all workspaces
make help         # full target list
```

Test data: `make seed` (idempotent) populates a "Test Family" household with a
parent, two kids, chores, and sample activity. It talks to the running server's
API. For a clean, ledger-consistent slate: stop the server, `make reset-db`,
start the server, then `make seed`. All seeded logins use password `password123`.

PocketBase binary is not committed — run `make pb-download` (or grab it from the [releases page](https://github.com/pocketbase/pocketbase/releases)) into `pocketbase/`.

## Toolchain notes (non-obvious)

- **Node** via asdf (`.tool-versions` → nodejs 24.7.0). **pnpm** via corepack; if `pnpm` isn't found after enabling, run `asdf reshim nodejs`.
- **`node-linker=hoisted`** (in `.npmrc`) is required — React Native / Expo's Metro bundler assumes a flat `node_modules`, and pnpm's default symlinked layout breaks resolution of transitive deps (`@babel/runtime`, `expo-modules-core`).
- **React is pinned to 19.2.3 workspace-wide** via `pnpm.overrides` (root `package.json`). Expo SDK 56 needs that exact version; without the override, hoisting mixes React versions and Next's prerender fails with a null `useContext`.
- **`@paydirt/shared`** is consumed as TypeScript source (no build step). Imports are extensionless so vitest, Next/webpack, and Metro all resolve them. Next transpiles it via `transpilePackages`.
- The PostToolUse hook syncs `AGENTS.md` → `CLAUDE.md`; edit **AGENTS.md**, not CLAUDE.md.

## Key Concepts

- **Roles**: One mobile app binary; parent vs. child determined at login. Parents also use the web dashboard.
- **parentBucks**: Virtual currency earned on parent-approved chore completion. Configurable reward per chore. Spent via request → parent approval → deduction.
- **Race mechanic** (post-MVP): a chore assignable to multiple kids; first one approved wins the reward.
- **Simplified mode** (post-MVP): per-child UI toggle — larger tap targets, icon-heavy, minimal reading. Default on for the youngest (age 6); standard UI for the 11-year-old.
- **No Google**: Stack deliberately avoids Play Services. ntfy over FCM, PocketBase over Firebase.
- **Family Link automation** is a future phase (Accessibility Service, then custom MDM) — see plan.

Full phased plan: `~/.windsurf/plans/choregalore-plan.md` (codename was "choregalore"). See `ROADMAP.md` and `FEATURES.md` for current scope.
