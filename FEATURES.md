# Features

Current scope tracker. See [ROADMAP.md](./ROADMAP.md) for phasing and the full plan at `~/.windsurf/plans/choregalore-plan.md`.

## Implemented

- **Data model** — MVP collections ([docs/DATA_MODEL.md](./docs/DATA_MODEL.md)) as a verified PocketBase migration; TypeScript mirror in `packages/shared`.
- **Access rules** — household-scoped API rules for all collections; guard hook blocks kids from self-approving chores.
- **Currency hooks** — verified against PocketBase 0.39.3: chore approval earns parentBucks, spend approval deducts, ledger maintains the cached balance, over-spending is blocked, re-approval is idempotent.
- **Notification hooks** — ntfy fires wired for chore assigned/completed/approved/rejected and spend submitted/resolved (HTTP send path not yet live-tested — needs a real ntfy topic).
- **Shared client** (`packages/shared`) — typed PocketBase wrapper (auth, chores, assignments, currency, spend). Verified end-to-end via a live integration test (real user auth + rules + guards).
- **Web dashboard** (`apps/web`, Next.js) — parent login, kids' balances, pending approvals (approve/reject), spend requests (approve/deny), create/assign chores. Builds and serves.
- **Mobile app** (`apps/mobile`, Expo + react-native-paper) — role-gated; kid screen with balance, assigned chores (mark done), and spend requests. Bundles via Metro. **Not yet run on a device/emulator.**

## In Progress

- On-device verification of the mobile app (Expo Go / emulator).
- Live ntfy send (needs a configured topic per user).

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
