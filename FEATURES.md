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
- **Approval undo** — "Recently approved" section in dashboard; `undoApproval()` moves the assignment back to completed and a server hook writes the compensating ledger entry (double-undo impossible; kids blocked from touching approved chores).
- **Real-time updates** — kid screens subscribe to their assignments + balance via PocketBase realtime (`subscribeToKidUpdates()`); approvals appear without pull-to-refresh. SSE polyfill (`react-native-sse`) on mobile.
- **Household broadcast** — parent sends a one-liner to all kids from the dashboard; `broadcasts` collection + ntfy fan-out hook; only parents can send.
- **Integration test suite** — live API tests for the shared client and every PB hook/guard (currency math, undo reversal, photo guard, balance guard, role guards, broadcast rules, realtime). `make test-integration`.
- **Playwright e2e** — dashboard golden path (create → assign → complete → approve → undo) and broadcast UI. `make test-e2e`.
- **ntfy kill-switch** — `NTFY_DISABLED=1` suppresses all sends so test runs don't blast the real public topics.
- **Rejected-chore flow** — kids reply to rejections (`kid_response`, parents notified + shown in dashboard) or resubmit; resubmission requires a freshly uploaded photo, enforced server-side. Simplified mode gets a big "Try again 📷" button.
- **Collapsible history** — kid history is an accordion, closed by default, capped at the 50 most recent approvals (paged query, not getFullList).
- **Deadlines + escalating reminders** — optional `due_at` per chore; cron escalates 24h → 2h → overdue (parents pinged on overdue).
- **Race mechanic** — race chores assigned to everyone; first approval wins, the rest auto-close with a "who won" notification.
- **Kid-proposed chores** — kids pitch a chore + asking price; parents approve at a negotiated reward (auto-creates chore + assignment) or decline.
- **Savings goals** — kid-created targets with progress bars; hook marks achieved + notifies both sides when the balance crosses the target.
- **Bank threshold** — one-time ntfy nudge to the kid when their balance crosses the household threshold.
- **Currency expiry** — optional: earn entries older than N days lapse via compensating adjustments (daily cron), capped at current balance.
- **Goods conversion display** — household `goods_rate` (bucks per $1) shown on spend requests and the kid's spend dialog.
- **Scheduled chore reminders** — per-chore "HH:MM"; cron reminds assigned kids once a day.
- **Approval nudges** — parents pinged when a completion sits unapproved longer than `nudge_hours`.
- **Approval reactions** — parents react with an emoji from "Recently approved"; kid gets pinged and sees it in history.
- **Kid reminders** — kids set one-shot reminders (1h / 3h / tomorrow) on their own chores.
- **Chore swap** — kid offers a chore to a sibling, who accepts (takes ownership) or declines; guarded server-side.
- **Streak bonuses** — consecutive earn-days tracked per kid (🔥 shown in both apps); milestone bonuses at 3/7/14/30 days.
- **Weekly digest** — Sunday-evening ntfy summary to parents (per-kid chores, earned/spent, balances, pending approvals).
- **Vacation mode** — household pause switch suspends cron reminders, nudges, digest, and expiry.
- **Household settings panel** — currency name, bank threshold, expiry days, goods rate, nudge hours, vacation mode — all in the dashboard.
- **Dev tooling** — `make dev-all` starts PB + web + Expo in one command with emulator check, health polling, and cache clear; `make stop` kills everything including the emulator app; `RESET=1 make dev-all` wipes and reseeds. `make seed`, `make reset-db`, `make lint`, `make typecheck`.

## Not Yet Implemented

- **Recurring chore auto-assignment** — the `cadence` field exists but nothing re-creates assignments on schedule yet.
- **On-device test** — emulator validated; GrapheneOS/LineageOS real device not yet tested.
- **Parent dashboard realtime** — the web dashboard still reloads after actions; only the kid screens subscribe live.

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
