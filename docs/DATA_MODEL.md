# Data Model (MVP)

Authoritative spec for the PocketBase collections. The TypeScript mirror lives in
`packages/shared/src/types.ts`; the migrations that create these live in
`pocketbase/pb_migrations/`. Keep all three in sync.

## Collections

### `households`
| Field | Type | Notes |
|-------|------|-------|
| name | text | required |

### `users` (extends PocketBase auth)
| Field | Type | Notes |
|-------|------|-------|
| role | select(`parent`,`child`) | required |
| display_name | text | required |
| household | relation → households | required |
| ntfy_topic | text | optional; devices subscribe to this |
| balance | number | cached parentBucks; maintained by hook (children) |
| simplified_mode | bool | default false; on for youngest child |

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

### `assignments`
One per (chore, child). Status: `assigned` → `completed` → `approved`/`rejected`.

| Field | Type | Notes |
|-------|------|-------|
| chore | relation → chores | required |
| child | relation → users | required |
| status | select(`assigned`,`completed`,`approved`,`rejected`) | default `assigned` |
| completed_at | date | set when child marks done |
| approved_at | date | set on parent approval |
| photo | file (single) | optional proof |
| rejection_message | text | optional |

### `currency_transactions`
Append-only ledger. `+` earn, `−` spend. Sum = balance.

| Field | Type | Notes |
|-------|------|-------|
| user | relation → users | child; required |
| amount | number | required (signed) |
| type | select(`earn`,`spend`,`manual_adjustment`) | required |
| reason | text | optional |
| related_assignment | relation → assignments | optional |
| related_spend_request | relation → spend_requests | optional |

### `spend_requests`
| Field | Type | Notes |
|-------|------|-------|
| child | relation → users | required |
| amount | number | parentBucks to deduct; required |
| description | text | required (what they want) |
| status | select(`pending`,`approved`,`denied`) | default `pending` |
| resolved_at | date | set on resolve |
| resolved_by | relation → users | parent |

## Hooks (next to implement)

1. **transaction → balance**: on `currency_transactions` create, increment `users.balance` by `amount`. Single point that maintains the cached balance.
2. **assignment approval → earn**: on `assignments` update to `approved`, create an `earn` transaction for `chore.reward`.
3. **spend approval → spend**: on `spend_requests` update to `approved`, create a `spend` transaction for `−amount`.
4. **ntfy notifications**: fire on chore assigned, completed (→parent), approved/rejected (→child), spend submitted (→parent), spend resolved (→child).

## Design decisions

- **Cached balance vs. computed**: balance is a cached field on `users`, kept correct by hook #1. The ledger remains the source of truth; transactions are append-only (no edits/deletes) so the cache can't drift. Revisit if we ever need to void a transaction.
- **Assignments carry status, no separate `completions` collection (yet)**: for the MVP an assignment's status flow is enough. The plan's separate `completions` concept matters for the Phase 1 race mechanic (first of many to finish wins); we'll add it then rather than over-build now.
- **Reward not snapshotted on assignment**: the `earn` transaction records the actual amount awarded, so it is the snapshot. Changing a chore's reward later doesn't rewrite history.
