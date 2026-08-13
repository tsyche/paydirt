# PayDirt

*Do. The. Thing.*

A private family chore tracking app. Parents assign chores; kids complete them on Android devices and mark them done; parents approve. Rewards are virtual currency (**parentBucks**) that kids spend on screen time (manually granted), bank toward thresholds, or exchange for physical goods. Family-only — not a public app.

## Tech Stack

- **apps/web** — Next.js parent dashboard
- **apps/mobile** — Expo (React Native) + react-native-paper (Material Design 3); single binary, role-gated parent/kid views; no Google Play Services dependency (runs on GrapheneOS / LineageOS)
- **packages/shared** — shared TypeScript types, API clients, business logic, validation
- **pocketbase/** — PocketBase backend (auth, SQLite, real-time, file storage, JS hooks for business logic). Binary downloaded separately; `pb_hooks/` and `pb_migrations/` are version-controlled. Setup details: [pocketbase/README.md](./pocketbase/README.md)
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

Run `just` with no arguments for a scenario-based cheat sheet ("I want to do
X → run Y"). It covers: first-time setup, day-to-day Expo+emulator dev, live
Expo dev mode on a real phone, an already-installed APK that just needs the
backend + web dashboard reachable, and shipping a release build. `just --list`
shows every recipe (grouped); the commands below are the ones used outside
those scenarios:

```bash
just seed              # seed test household/users/chores (server must be RUNNING)
just reset-db          # wipe + rebuild empty DB (server must be STOPPED)
just test               # all workspace tests (unit; no server needed)
just test-integration  # live API/hook tests (needs running, seeded PB)
just test-e2e           # Playwright dashboard tests (needs running, seeded PB)
just verify-ledger      # recompute balances from currency_transactions, diff vs. cache (needs running PB)
just lint               # lint all workspaces
just typecheck          # type-check all workspaces (tsc --noEmit)
```

For the live test targets, start the backend with notifications muted so test
runs don't blast the real ntfy.sh topics: `NTFY_DISABLED=1 just dev-pb`, then
`just seed`.

CI (GitHub Actions, `.github/workflows/ci.yml`) runs `just lint`, `just
typecheck`, and `just test` on every push and PR. Integration + e2e run via
`just test-all` (self-contained — boots its own ephemeral PocketBase) gated
behind `workflow_dispatch`, since they're slower and don't need to run on
every push. `just test-all` also runs `just verify-ledger` against the
ephemeral instance.

Test data: `just seed` (idempotent) populates a "Test Family" household with two
parents, two kids, chores, and sample activity. It talks to the running server's
API. For a clean, ledger-consistent slate: stop the server, `just reset-db`,
start the server, then `just seed`. All seeded logins use password `password123`:
`parent1@test.local`, `parent2@test.local`, `child1@test.local`, `child2@test.local`.

PocketBase binary is not committed — run `just pb-download` (or grab it from the [releases page](https://github.com/pocketbase/pocketbase/releases)) into `pocketbase/`.

## Toolchain notes (non-obvious)

- **Node** via asdf (`.tool-versions` → nodejs 26.4.0). **pnpm** via corepack; if `pnpm` isn't found after enabling, run `asdf reshim nodejs`. Note: Node 26+ doesn't bundle corepack — run `npm install -g corepack && corepack enable && asdf reshim nodejs` once after installing a new Node version.
- **`node-linker=hoisted`** (in `.npmrc`) is required — React Native / Expo's Metro bundler assumes a flat `node_modules`, and pnpm's default symlinked layout breaks resolution of transitive deps (`@babel/runtime`, `expo-modules-core`).
- **React is pinned to 19.2.3 workspace-wide** via `pnpm.overrides` (root `package.json`). Expo SDK 57 needs that exact version; without the override, hoisting mixes React versions and Next's prerender fails with a null `useContext`.
- **`@paydirt/shared`** is consumed as TypeScript source (no build step). Imports are extensionless so vitest, Next/webpack, and Metro all resolve them. Next transpiles it via `transpilePackages`.
- The PostToolUse hook syncs `AGENTS.md` → `CLAUDE.md`; edit **AGENTS.md**, not CLAUDE.md.

## Key Concepts

- **Roles**: One mobile app binary; parent vs. child determined at login. Parents also use the web dashboard.
- **parentBucks**: Virtual currency earned on parent-approved chore completion. Configurable reward per chore. Spent via request → parent approval → deduction.
- **Race mechanic**: a chore assignable to multiple kids; first one approved wins the reward.
- **Simplified mode**: per-child UI toggle — larger tap targets, icon-heavy, minimal reading. Default on for the youngest (age 6); standard UI for the 11-year-old.
- **No Google**: Stack deliberately avoids Play Services. ntfy over FCM, PocketBase over Firebase.
- **Family Link automation** is a future phase (Accessibility Service, then custom MDM) — see plan.

`ROADMAP.md` is the authoritative source for phase and status; `FEATURES.md` tracks scope. The original design scratchpad (rationale + alternatives, archived 2026-08-10) is at `~/.claude/plans/archive/paydirt-plan.md` — codename was "choregalore".
