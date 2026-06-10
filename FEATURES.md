# Features

Current scope tracker. See [ROADMAP.md](./ROADMAP.md) for phasing and the full plan at `~/.windsurf/plans/choregalore-plan.md`.

## Implemented

- **Data model** — MVP collections ([docs/DATA_MODEL.md](./docs/DATA_MODEL.md)) as a verified PocketBase migration; TypeScript mirror in `packages/shared`.
- **Access rules** — household-scoped API rules for all collections; guard hook blocks kids from self-approving chores.
- **Currency hooks** — chore approval earns parentBucks, spend approval deducts, ledger maintains cached balance, over-spending blocked, re-approval idempotent.
- **Notification hooks** — ntfy fires for chore assigned/completed/approved/rejected and spend submitted/resolved. Topics set per user; end-to-end delivery confirmed.
- **Shared client** (`packages/shared`) — typed PocketBase wrapper (auth, chores, assignments, currency, spend). Integration-tested against live server.
- **Web dashboard** (`apps/web`, Next.js) — parent login, kids' balances, pending approvals (approve/reject), spend requests (approve/deny), create/assign chores, per-kid bonus/deduction.
- **Mobile app** (`apps/mobile`, Expo + react-native-paper) — role-gated; kid screen (balance, chores, mark done, spend request); simplified mode for young kids; runs on emulator.
- **Simplified mode** — `SimpleKidHome` screen with giant text/buttons for early readers; branches on `simplified_mode` user field.
- **Bonus/deduction UI** — `AdjustControl` per kid in the parent dashboard; calls `adjustBalance()`.
- **Per-kid ledger view** — `LedgerToggle` in parent dashboard shows full transaction history per kid.
- **photo_required enforcement** — server guard (`guards.pb.js`) rejects completion without a photo; `KidHome` shows camera button for photo-required chores (`expo-image-picker`).
- **Approval undo** — "Recently approved" section in dashboard; Undo writes a compensating `manual_adjustment` via `reverseApproval()`.
- **Dev tooling** — `make dev-all` starts PB + web + Expo in one command with emulator check, health polling, and cache clear; `make stop` kills everything including the emulator app; `RESET=1 make dev-all` wipes and reseeds. `make seed`, `make reset-db`, `make lint`, `make typecheck`.

## Not Yet Implemented

- **Real-time updates** — kids must pull-to-refresh to see approvals; PocketBase subscriptions not yet wired.
- **Integration/API tests** — no automated tests for PB hooks or the shared client; no Playwright coverage for the web dashboard.
- **Household broadcast** — parent → all kids ntfy message; ntfy wiring exists but no UI.
- **On-device test** — emulator validated; GrapheneOS/LineageOS real device not yet tested.

## MVP Target

**Chores**
- Create/edit/delete chores (name, description, reward)
- One-off and recurring (daily, weekly, custom cadence)
- Assign to one or multiple children
- Status flow: assigned → completed (child) → approved/rejected (parent)
- Rejection notification with optional parent message
- Optional photo proof on completion

**Kid app**
- View assigned chores
- Mark complete (with optional photo)
- View parentBucks balance
- Submit spend request (parent notified immediately)
- Spend request history

**Parent app (web + Android)**
- Dashboard: pending approvals, chore status, balances
- Manage chores and assignments
- Approve/reject completions
- Approve/deny spend requests

**Currency**
- Configurable currency name and per-chore reward
- Earned on parent approval
- Spend flow: request → approve/deny → deduct

**Notifications (ntfy)**
- Child: chore assigned, spend approved/denied, chore rejected
- Parent: chore pending approval, spend request submitted
- Configurable topic per user
