# Data Model (MVP)

**TL;DR:** PocketBase collections, hooks, and cron jobs define PayDirt's business rules. The append-only currency ledger owns balances; approved screen-time purchases optionally feed the separate Family Link worker.

Authoritative spec for the PocketBase collections. The TypeScript mirror lives in
`packages/shared/src/types.ts`; the migrations that create these live in
`pocketbase/pb_migrations/`. Keep all three in sync.

All base collections also carry `created` and `updated` autodate fields. PocketBase
v0.23+ does **not** add these automatically, so they're declared explicitly: the
original five collections got them retrofitted in `1717000002_add_timestamps.js`,
and later collections (`broadcasts`, `savings_goals`, `chore_proposals`, etc.)
declare them in their own creation migration. Omitting them previously caused
`sort=created` queries to 400.

## Collections

### `households`
| Field | Type | Notes |
|-------|------|-------|
| name | text | required |
| currency_name | text | display name for the currency; empty = "Grit" (see `packages/shared/src/currency.ts`) |
| bank_threshold | number | notify kid when balance crosses it; 0 = off |
| expiry_days | number | earn entries lapse after N days (daily cron); 0 = off |
| goods_rate | number | bucks per $1 for conversion display; 0 = off |
| nudge_hours | number | nudge parents when a completion waits N hours; 0 = off |
| paused | bool | vacation mode: cron reminders/nudges/digest/expiry suspended |
| screen_rate | number | parentBucks per screen-time minute; 0 = 1:1 (see `packages/shared/src/screenTime.ts`) |
| quiet_start / quiet_end | text | "HH:MM" quiet-hours window; pushes in it are held back (still logged to `inbox`); wraps midnight |
| streak_bonus_3 / _7 / _14 / _30 | number | bonus granted at each streak milestone; 0 = default |
| allowance_amount / allowance_cadence / allowance_last_paid | number / select(`daily`,`weekly`) / date | scheduled allowance; paid by the daily cron, `allowance_last_paid` is the dedupe marker |

### `users` (extends PocketBase auth)
| Field | Type | Notes |
|-------|------|-------|
| role | select(`parent`,`child`) | required |
| display_name | text | required |
| household | relation → households | required |
| ntfy_topic | text | optional; server fallback when `up_endpoint` is empty (setup no longer asks for it) |
| balance | number | cached parentBucks; maintained by hook (children) |
| simplified_mode | bool | default false; on for youngest child |
| calm_mode | bool | default false; parent dial-back silences playful extras (badges, confetti, count-up) |
| digest_weekday / digest_weekend | text | "HH:MM" server-local time for the kid's once-a-day "Chores today" summary push on weekdays / Sat-Sun; blank = off. Parent-only (guards allowlist) |
| digest_sent | text | local YYYY-MM-DD of the last summary (dedupe marker; set by the tick) |
| streak_count | number | consecutive earn-days; maintained by hook + daily cron |
| fl_child_id / fl_device_id | text | Family Link grant target for this kid's tablet; parent-set, pattern-validated |
| up_endpoint | text | UnifiedPush endpoint the app registers; primary push target (`ntfy_topic` is the fallback) |
| avatar_emoji / color | text | kid's avatar emoji and accent color (not `avatar`, which is PocketBase's built-in file field) |
| avatar | file | optional uploaded avatar image |
| goods_rate | number | per-kid override of the household `goods_rate`; 0/unset = use the household rate |

### `chores`
| Field | Type | Notes |
|-------|------|-------|
| household | relation → households | required |
| name | text | required |
| description | text | optional |
| reward | number | parentBucks on approval; required for `bucks`/`both`, forced to 0 for `time` |
| pay_mode | select(`bucks`,`time`,`both`) | what approval pays; empty = `bucks`. Same on `chore_templates` |
| reward_minutes | number | screen minutes on approval (`time`/`both`); multiples of 5, max 120; forced to 0 for `bucks`. Same on `chore_templates` |
| type | select(`oneoff`,`recurring`) | required |
| cadence | text | only for recurring (`daily`/`weekly`/custom) |
| photo_required | bool | default false |
| created_by | relation → users | parent |
| active | bool | default true |
| due_at | date | optional deadline; cron escalates reminders 24h → 2h → overdue |
| race | bool | first approval wins; other assignments auto-close |
| reminder_time | text | "HH:MM" server-local; cron reminds assigned kids daily |
| max_per_period | number | normal repeat limit per kid per cadence window (daily 1d, weekly 7d, monthly 30d, one-off 7d); 0/unset = none. Advisory: assigning past it warns and the parent can override (`assignLimitWarnings`, `packages/shared/src/choreLimit.ts`); nothing server-side. Also on `chore_templates` |

### `assignments`
One per (chore, child). Status: `assigned` → `completed` → `approved`/`rejected`;
`rejected` → `completed` again on resubmit (a fresh photo is mandatory);
`closed` = race lost (hook-set, terminal).

| Field | Type | Notes |
|-------|------|-------|
| chore | relation → chores | required |
| child | relation → users | required |
| status | select(`assigned`,`completed`,`approved`,`rejected`,`closed`) | default `assigned` |
| completed_at | date | set when child marks done |
| approved_at | date | set on parent approval |
| photo | file (single) | optional proof |
| rejection_message | text | optional |
| kid_response | text | kid's reply to a rejection; parents notified |
| reaction | text | parent's emoji reaction to an approval; kid notified |
| reminder_stage | number | deadline escalation progress (cron dedupe) |
| kid_reminder_at | date | kid-set one-shot reminder; cron fires + clears |
| last_reminded | date | scheduled-reminder dedupe marker (cron) |
| nudged_at | date | approval-nudge dedupe marker (cron) |
| swap_to | relation → users | pending swap offer to a sibling |
| needs_help | bool | kid's "I need help" flag; pings parents, cleared on mark-done/approve |

### `currency_transactions`
Append-only ledger. `+` earn, `−` spend. Sum = balance. `just verify-ledger` recomputes and diffs this invariant against every user's cached `balance`.

| Field | Type | Notes |
|-------|------|-------|
| user | relation → users | child; required |
| amount | number | required (signed) |
| type | select(`earn`,`spend`,`manual_adjustment`) | required |
| reason | text | optional |
| related_assignment | relation → assignments | optional |
| related_spend_request | relation → spend_requests | optional |
| expiry_processed | bool | set by daily cron after expiry entry written (dedupe guard) |

### `spend_requests`
| Field | Type | Notes |
|-------|------|-------|
| child | relation → users | required |
| amount | number | parentBucks to deduct; required |
| description | text | required (what they want) |
| status | select(`pending`,`approved`,`denied`) | default `pending` |
| resolved_at | date | set on resolve |
| resolved_by | relation → users | parent |
| screen_minutes | number | set = screen-time request (15/30/45/60); the create hook sets `amount` from `screen_rate` |
| grant_status | select(`queued`,`granted`,`manual`,`manual_done`) | optional; server-owned automation state; parents may confirm `manual` → `manual_done` |
| grant_error | text | optional, max 300; safe manual-recovery message |

Submitted spending terms and settled approval decisions are immutable. Screen-time
approval queues a grant only when automation is enabled and the child has target
IDs; otherwise it becomes a manual task. Goods requests have no grant state.
The separate worker writes receipts, and a minute cron imports results; see
[deployment](DEPLOYMENT.md#queue-and-failure-handling). Neither Google credentials
nor browser responses are stored in these records.

### `time_grants`
Bonus screen minutes earned by an approved chore (`pay_mode` `time`/`both`). Created only by the approval hook, one per assignment (unique index). Clients can list/view and parents can confirm `manual` → `manual_done`; everything else is server-owned and rows can't be deleted by clients.

| Field | Type | Notes |
|-------|------|-------|
| child | relation → users | required |
| assignment | relation → assignments | unique when set |
| minutes | number | required; snapshot of the chore's `reward_minutes` at approval |
| description | text | e.g. `Chore: Dishes (10 min bonus)` |
| grant_status | select(`queued`,`granted`,`manual`,`manual_done`) | same states and queue as purchases |
| grant_error | text | optional, max 300 |

### `savings_goals`
Kid-owned targets; a hook marks them achieved + notifies when the balance
crosses the target.

| Field | Type | Notes |
|-------|------|-------|
| child | relation → users | required; kid or parent may create/update/delete |
| name | text | required |
| target | number | required |
| achieved | bool | hook-set |
| achieved_at | date | hook-set |
| auto_save_percent | number | % of each earn auto-saved toward this goal (with a notification) |
| details | text (max 500) | optional notes shown when the goal is expanded |

### `chore_templates`
Household-saved chore blueprints (name, description, reward, type, cadence, `photo_required`, `race`, `reminder_time`, `max_per_period`) that pre-fill the create-chore form.

### `chore_proposals`
A kid pitches a chore + asking price; a parent approves (client creates the
real chore + assignment) or declines.

| Field | Type | Notes |
|-------|------|-------|
| household | relation → households | required |
| child | relation → users | proposer; create rule: self only |
| name | text | required |
| description | text | optional |
| reward_requested | number | required; parent may approve at a different reward |
| status | select(`pending`,`approved`,`declined`) | parents resolve |
| resolved_by | relation → users | parent |

### `broadcasts`
A one-liner from a parent to every kid in the household. Creating a record
triggers the ntfy fan-out hook. Read-only history after creation (no
update/delete rules).

| Field | Type | Notes |
|-------|------|-------|
| household | relation → households | required |
| sender | relation → users | parent; required |
| message | text | required |

### `broadcast_replies`
A kid's one-tap canned answer to a broadcast (`ok`, `question`, `later`, `please`; see
`packages/shared/src/broadcastReply.ts`). One per kid per broadcast (unique index);
kids create their own, no update/delete. The notification hook pings every parent with the
reply and the original message.

| Field | Type | Notes |
|-------|------|-------|
| broadcast | relation → broadcasts | required; cascade delete |
| child | relation → users | must be the caller; required |
| code | select | ok / question / later / please |

### `inbox`
Per-user copy of every push the server sends (also during quiet hours), so
people can review and clear past alerts. Owner can list/view/delete; clients
can't create or edit. Written by `logToInbox()` in `lib/ntfy.js`; the daily
cron prunes items older than 30 days. Deleting an item never affects real data.

| Field | Type | Notes |
|-------|------|-------|
| user | relation → users | owner; required |
| title | text | required |
| body | text | |
| type | text | push type, e.g. `broadcast`; `broadcast_sent` is the sending parent's copy |

## Hooks (implemented)

Live in `pocketbase/pb_hooks/`. PocketBase runs each handler in an isolated VM, so shared helpers are `require()`'d **inside** each handler (see `lib/ntfy.js`).

1. **transaction → balance** (`currency.pb.js`): on `currency_transactions` create, increment `users.balance` by `amount`. Single point that maintains the cached balance.
2. **assignment approval → pay** (`currency.pb.js`): on `assignments` update to `approved`, pay by the chore's `pay_mode` (`lib/chorePay.js`): an `earn` transaction for `reward` (`bucks`/`both`) and/or a `time_grants` row for `reward_minutes` (`time`/`both`), queued like a purchase. A `time`-only approval has no earn row, so the streak is refreshed directly (`computeStreak` also counts `time_grants` days). Known gap: weekly recaps, `ActivityReport` and ledger views total bucks from `currency_transactions`, so minutes don't appear there (chore counts, streaks and badges do count time chores).
3. **spend approval → spend** (`currency.pb.js`): on `spend_requests` update to `approved`, guard the balance first, then create a `spend` transaction for `−amount`. On API create, a request is forced `pending` with a positive `amount`; screen-time requests are priced server-side (client `amount` ignored).
4. **approval undo → reversal** (`currency.pb.js`): on `assignments` update *out of* `approved`, create a compensating `manual_adjustment` for the net of that assignment's own ledger rows (not the chore's current reward, which may have been edited). Undo is therefore a single status change; the ledger can't drift from the status. An assignment that earned a `time_grants` row can't be undone (Family Link grants are additive); `guards.pb.js` blocks it by grant row, not by the chore's current mode.
5. **ntfy notifications** (`notifications.pb.js`): fire on chore assigned, completed (→parent, except when a parent undoes an approval), approved/rejected (→child), spend submitted (→parent), spend resolved (→child), broadcast created (→all children). Set `NTFY_DISABLED=1` to suppress sends (use for test runs — the seeded topics are real public ntfy.sh topics).
6. **approval guard** (`guards.pb.js`): block non-parents from setting an assignment to `approved`/`rejected`/`closed`, from touching settled (`approved`/`closed`) assignments, and from invalid swap moves (owner can't reassign directly; the swap target may only accept or decline). Resubmitting a `rejected` chore requires a freshly uploaded photo, even when the chore doesn't normally need one. On `users`, a non-parent self-edit may change only `up_endpoint`/`ntfy_topic` (and their own password); every other field is parent-only.
7. **race close** (`races.pb.js`): first approval of a race chore closes every other open assignment for it and tells the losing kids who won.
8. **balance reactions** (`lib/balanceReactions.js`, called from `currency.pb.js` right after the balance update so it never reads a stale balance): on each ledger entry — mark crossed savings goals achieved (+notify), fire the one-time bank-threshold nudge, maintain `streak_count`, and grant streak milestone bonuses (3/7/14/30 days).
9. **engagement notifications** (`notifications.pb.js`): kid rejection replies and swap offers ping the relevant party; parent reactions ping the kid; proposals ping parents on create and the kid on resolve; a kid flagging `needs_help` pings parents. Every send is also logged to `inbox`.
10. **screen-time grants** (`familylink.pb.js`): protect submitted spending terms, settled decisions, and server-owned grant fields; approval sets the grant state and publishes committed purchases to the worker queue. Parents may confirm manual completion. `time_grants` (chore bonuses) use the same queue and states; the cron reconciles both collections.
11. **pay-mode validation** (`guards.pb.js` → `lib/chorePay.js`): every chore/template create or edit must pay something valid (reward above 0 for bucks, minutes in steps of 5 up to 120 for time) and stores only what the mode pays. Mirrors `packages/shared/src/chorePay.ts`.

## Cron jobs (`scheduler.pb.js` → `lib/scheduler.js`)

Server-local time. Manual triggers for tests/debugging: `POST /api/paydirt/cron/{tick|daily|digest|kid-recap|allowance}` (superuser only). All sends respect `NTFY_DISABLED` and skip `paused` households.
The separate Family Link reconciliation job lives in `familylink.pb.js`; it processes explicitly approved purchases regardless of household scheduling pauses.

| Job | Schedule | Does |
|-----|----------|------|
| paydirt_tick | every 10 min | approval nudges (`nudge_hours`), daily chore reminders (`reminder_time`), deadline escalation (`due_at`: 24h → 2h → overdue, parents pinged on overdue), kid one-shot reminders, per-kid chore summary (`digest_*`) |
| paydirt_daily | 03:00 | currency expiry (`expiry_days`, compensating negative adjustment capped at balance), streak refresh (zeroes broken streaks), recurring chore auto-assignment (silent: `assignments.auto_created`, no per-chore push; re-creates assignments for recurring chores when no open one exists per kid) |
| paydirt_digest | Sun 18:00 | weekly per-kid summary (chores, earned/spent, balances, pending count) to parents |
| paydirt_kid_recap | Sun 10:00 | per-kid weekly ntfy recap (earnings, chores, nearest goal); skips `paused` households |
| paydirt_allowance | daily 06:00 | pays the scheduled allowance when due (`allowance_*`), notifies kids |
| paydirt_familylink | every minute | repair missed queue publication and import grant receipts; notify parents of manual recovery |

## Design decisions

- **Cached balance vs. computed**: balance is a cached field on `users`, kept correct by hook #1. The ledger remains the source of truth; transactions are append-only (no edits/deletes) so the cache can't drift. Voiding happens via compensating entries, never edits — approval undo (hook #4) is the canonical example.
- **Assignments carry status, no separate `completions` collection**: the status flow is enough. The race mechanic (first approval wins) is handled by `races.pb.js` closing losing assignments on the existing `assignments` collection.
- **Reward not snapshotted on assignment**: the `earn` transaction (and the `time_grants` row for minutes) records what was actually awarded, so it is the snapshot. Changing a chore's reward or pay mode later doesn't rewrite history.
