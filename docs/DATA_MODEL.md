# Data Model (MVP)

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
| currency_name | text | display name for the currency; empty = "parentBucks" |
| bank_threshold | number | notify kid when balance crosses it; 0 = off |
| expiry_days | number | earn entries lapse after N days (daily cron); 0 = off |
| goods_rate | number | bucks per $1 for conversion display; 0 = off |
| nudge_hours | number | nudge parents when a completion waits N hours; 0 = off |
| paused | bool | vacation mode: cron reminders/nudges/digest/expiry suspended |

### `users` (extends PocketBase auth)
| Field | Type | Notes |
|-------|------|-------|
| role | select(`parent`,`child`) | required |
| display_name | text | required |
| household | relation → households | required |
| ntfy_topic | text | optional; devices subscribe to this |
| balance | number | cached parentBucks; maintained by hook (children) |
| simplified_mode | bool | default false; on for youngest child |
| streak_count | number | consecutive earn-days; maintained by hook + daily cron |

### `chores`
| Field | Type | Notes |
|-------|------|-------|
| household | relation → households | required |
| name | text | required |
| description | text | optional |
| reward | number | parentBucks on approval; required |
| type | select(`oneoff`,`recurring`) | required |
| cadence | text | only for recurring (`daily`/`weekly`/custom) |
| photo_required | bool | default false |
| created_by | relation → users | parent |
| active | bool | default true |
| due_at | date | optional deadline; cron escalates reminders 24h → 2h → overdue |
| race | bool | first approval wins; other assignments auto-close |
| reminder_time | text | "HH:MM" server-local; cron reminds assigned kids daily |

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

## Hooks (implemented)

Live in `pocketbase/pb_hooks/`. PocketBase runs each handler in an isolated VM, so shared helpers are `require()`'d **inside** each handler (see `lib/ntfy.js`).

1. **transaction → balance** (`currency.pb.js`): on `currency_transactions` create, increment `users.balance` by `amount`. Single point that maintains the cached balance.
2. **assignment approval → earn** (`currency.pb.js`): on `assignments` update to `approved`, create an `earn` transaction for `chore.reward`.
3. **spend approval → spend** (`currency.pb.js`): on `spend_requests` update to `approved`, guard the balance first, then create a `spend` transaction for `−amount`.
4. **approval undo → reversal** (`currency.pb.js`): on `assignments` update *out of* `approved`, create a compensating `manual_adjustment` for `−chore.reward`. Undo is therefore a single status change; the ledger can't drift from the status.
5. **ntfy notifications** (`notifications.pb.js`): fire on chore assigned, completed (→parent, except when a parent undoes an approval), approved/rejected (→child), spend submitted (→parent), spend resolved (→child), broadcast created (→all children). Set `NTFY_DISABLED=1` to suppress sends (use for test runs — the seeded topics are real public ntfy.sh topics).
6. **approval guard** (`guards.pb.js`): block non-parents from setting an assignment to `approved`/`rejected`/`closed`, from touching settled (`approved`/`closed`) assignments, and from invalid swap moves (owner can't reassign directly; the swap target may only accept or decline). Resubmitting a `rejected` chore requires a freshly uploaded photo, even when the chore doesn't normally need one.
7. **race close** (`races.pb.js`): first approval of a race chore closes every other open assignment for it and tells the losing kids who won.
8. **balance reactions** (`goals.pb.js`): on each ledger entry — mark crossed savings goals achieved (+notify), fire the one-time bank-threshold nudge, maintain `streak_count`, and grant streak milestone bonuses (3/7/14/30 days). Runs after `currency.pb.js` (alphabetical load order — don't rename either file).
9. **engagement notifications** (`notifications.pb.js`): kid rejection replies and swap offers ping the relevant party; parent reactions ping the kid; proposals ping parents on create and the kid on resolve.

## Cron jobs (`scheduler.pb.js` → `lib/scheduler.js`)

Server-local time. Manual triggers for tests/debugging: `POST /api/paydirt/cron/{tick|daily|digest}` (superuser only). All sends respect `NTFY_DISABLED` and skip `paused` households.

| Job | Schedule | Does |
|-----|----------|------|
| paydirt_tick | every 10 min | approval nudges (`nudge_hours`), daily chore reminders (`reminder_time`), deadline escalation (`due_at`: 24h → 2h → overdue, parents pinged on overdue), kid one-shot reminders |
| paydirt_daily | 03:00 | currency expiry (`expiry_days`, compensating negative adjustment capped at balance), streak refresh (zeroes broken streaks), recurring chore auto-assignment (re-creates assignments for recurring chores when no open one exists per kid) |
| paydirt_digest | Sun 18:00 | weekly per-kid summary (chores, earned/spent, balances, pending count) to parents |

## Design decisions

- **Cached balance vs. computed**: balance is a cached field on `users`, kept correct by hook #1. The ledger remains the source of truth; transactions are append-only (no edits/deletes) so the cache can't drift. Voiding happens via compensating entries, never edits — approval undo (hook #4) is the canonical example.
- **Assignments carry status, no separate `completions` collection**: the status flow is enough. The race mechanic (first approval wins) is handled by `races.pb.js` closing losing assignments on the existing `assignments` collection.
- **Reward not snapshotted on assignment**: the `earn` transaction records the actual amount awarded, so it is the snapshot. Changing a chore's reward later doesn't rewrite history.
