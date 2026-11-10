# Data Model (MVP)

**TL;DR:** PocketBase collections, hooks, and cron jobs define PayDirt's business rules. Separate append-only Grit and earned-minute ledgers own balances. Only explicitly redeemed or purchased minutes feed the Family Link worker. Private chore conversations record messages and decisions without coupling them to payment.

Authoritative spec for the PocketBase collections. The TypeScript mirror lives in
`packages/shared/src/types.ts`; the migrations that create these live in
`pocketbase/pb_migrations/`. Keep all three in sync.

Base collections declare their timestamps explicitly; the immutable minute ledger and redemption records use `created` only. PocketBase
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
| kudos_default_bucks | number | default amount for a parent "Great work" bonus; unset = 100 |
| grant_weekday_window / grant_weekend_window | text | comma-separated HH:MM-HH:MM ranges in delivery timezone; blank or `all` = all day, `none` = no delivery; overnight allowed; checked before publishing |
| grant_timezone / grant_expiry_days | text / number | household IANA timezone for dates, daily limits, schedules, reminders, streaks, and reports (blank = `America/Los_Angeles`); queued expiry after N elapsed days (0 = never), routed to manual review |
| grant_day_windows | text | sparse JSON day overrides (`0` Sunday through `6` Saturday): `all`, `none`, or comma-separated `HH:MM-HH:MM` ranges; missing days use weekday/weekend defaults |

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
| digest_weekday / digest_weekend | text | "HH:MM" household time for the kid's once-a-day "Chores today" summary push on weekdays / Sat-Sun; blank = off. Parent-only (guards allowlist) |
| digest_sent | text | local YYYY-MM-DD of the last summary (dedupe marker; set by the tick) |
| streak_count | number | consecutive earn-days; maintained by hook + daily cron |
| fl_child_id / fl_device_id | text | Family Link grant target for this kid's tablet; parent-set, pattern-validated |
| up_endpoint | text | UnifiedPush endpoint the app registers; primary push target (`ntfy_topic` is the fallback) |
| avatar_emoji / color | text | kid's avatar emoji and accent color (not `avatar`, which is PocketBase's built-in file field) |
| avatar | file | optional uploaded avatar image |
| goods_rate | number | per-kid override of the household `goods_rate`; 0/unset = use the household rate |
| grant_weekday_window / grant_weekend_window | text | parent-set delivery overrides; blank inherits household; `all` allows all day |
| grant_day_windows | text | parent-set sparse day overrides, same format as household; missing days use kid defaults, then household day/default settings |

### `chores`
| Field | Type | Notes |
|-------|------|-------|
| household | relation → households | required |
| name | text | required |
| description | text | optional chore instructions; API capped at 1,000 characters; assignments show the current value |
| reward | number | parentBucks on approval; required for `bucks`/`both`, forced to 0 for `time` |
| pay_mode | select(`bucks`,`time`,`both`) | what approval pays; empty = `bucks`. Same on `chore_templates` |
| reward_minutes | number | screen minutes on approval (`time`/`both`); multiples of 5, max 120; forced to 0 for `bucks`. Same on `chore_templates` |
| type | select(`oneoff`,`recurring`) | required |
| cadence | text | only for recurring (`daily`/`weekly`/custom) |
| photo_required | bool | default false |
| created_by | relation → users | parent |
| active | bool | default true |
| due_at | date | optional deadline; cron escalates reminders 24h → 2h → overdue |
| timer_minutes | number | 0 disables; integer 1–480 requires a continuous timer; also on templates |
| due_time / due_day | text / number | recurring deadline: HH:MM household time; weekly day 0 Sunday–6 Saturday, monthly day 1–31 clamped to month end; also on templates |
| race | bool | first approval wins; other assignments auto-close |
| reminder_time | text | "HH:MM" household time; cron reminds assigned kids daily |
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
| time_choice | select(`bank`,`use`) | kid selects at submission; default Bank; frozen while awaiting approval; Use now redeems whole 15-minute blocks up to 60 minutes after approval, saving any remainder |
| due_at | date | server-computed recurring deadline, fixed at assignment creation; new rule applies to future assignments |
| approved_at | date | set on parent approval |
| credit_percent | number | parent-only integer 1–100 on approval; legacy 0/unset = full credit; immutable while settled. Partial approval closes the assignment |
| submission_note | text | owner-only completion note, up to 1,000 characters; captured atomically in the thread on submission, then cleared on later updates |
| thread_actor | text | private server-owned API actor used for decision attribution; ignored from client input and hidden in responses |
| approval_comment | text | optional legacy parent feedback, trimmed, max 500 characters; set only when approving, cleared on undo; visible only to parents and the assigned child |
| timer_minutes / timer_started_at | number / date | duration fixed at creation; owner may start once using server clock; swaps clear start; completion before elapsed duration is blocked |
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

### `chore_messages`

An immutable timeline per assignment occurrence. New messages are plain text,
1–1,000 characters; corrections use a follow-up reply. No attachments or message
edit/delete API. History is retained with the occurrence; personal archives never
delete it or affect another participant. Occurrence deletion is blocked while its
conversation exists. Legacy feedback is backfilled without rewriting old fields;
when the original parent author is unknown, it is labelled "Parent". Legacy
rejection/reply times use the record's last-update date and are labelled as such;
known submission/approval dates remain exact.

| Field | Type | Notes |
|-------|------|-------|
| assignment / child | relations → assignments / users | occurrence and original kid audience; reassignment does not expose old messages to the new kid |
| author / author_name / author_role | relation / text / select | server-stamped author ID plus name/role snapshots; system and unknown legacy authors are explicit |
| kind | select | `message`, `submitted`, `approved`, `rejected`, `reopened`, `closed`, or `legacy` |
| body | text | message, submission note, or decision feedback; older feedback is retained even if longer than the new-message limit |
| sequence | integer | unique monotonic order within the occurrence, allocated inside the write transaction |
| request_key | text | unique per author when set; uncertain sends retry the same key/body/occurrence |
| created | autodate | server time, displayed in household timezone; known legacy submission/approval dates are preserved |

`POST /api/paydirt/assignments/{id}/messages` accepts `body` and `request_key`.
Only the currently assigned kid or a parent in the household may send. Kids read
only their original-audience rows; parents read their household's conversation.
Collection writes are closed to clients. Message sends never update assignment
status, timers, earnings, or approvals. Assignment decisions append their own
transactional events; completion notes use the existing proof/timer checks.

Web/mobile drafts persist per user and occurrence. An uncertain send locks its
body until retry resolves; edits cannot silently reuse its key. Parent decisions
never send an unsent draft. New messages notify the other parents and the current
kid without sibling fan-out. Inbox `source` links identify the occurrence;
Android links carry an inbox ID which is fetched under the current user's access
rules before opening the thread. Migration rollback refuses populated threads.
Legacy `approval_comment`, `rejection_message`, `kid_response`, and submission
notes are hidden from sibling assignment responses. Reassignment clears these
legacy field copies while preserving the original kid's private timeline.

### `currency_transactions`
Append-only ledger. `+` earn/kudos, `−` spend. Sum = balance. `just verify-ledger` recomputes and diffs this invariant against every user's cached `balance`.

| Field | Type | Notes |
|-------|------|-------|
| user | relation → users | child; required |
| amount | number | required (signed) |
| type | select(`earn`,`spend`,`manual_adjustment`,`kudos`) | required; `kudos` credits never expire |
| reason | text | optional |
| related_assignment | relation → assignments | optional |
| related_spend_request | relation → spend_requests | optional |
| related_kudos | relation → kudos | optional |
| expiry_processed | bool | set by daily cron once an earn row is past `expiry_days` (dedupe guard; processed lots count as gone for later spends) |

### `kudos`
An immutable parent-to-child "Great work" award. The parent creates it; its
after-create hook writes one linked `kudos` ledger credit and notifies the kid.
Kids can list only their own awards and may make a single server-timestamped
acknowledgement so a celebration plays once across all of their devices.

| Field | Type | Notes |
|-------|------|-------|
| household | relation → households | required |
| child | relation → users | required recipient |
| given_by | relation → users | required parent; server-owned |
| reason | text (max 500) | optional plain-text praise |
| bucks | number | required positive award amount |
| seen_at | date | null until the child has seen the celebration; server-owned |

### `spend_requests`

Kids can read only their own requests; household parents can read their kids' requests.
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
| grant_delivered_seconds | number | server-owned successful delivery total; remaining minutes stay queued across windows |

Submitted spending terms and settled approval decisions are immutable. Screen-time
approval queues a grant only when automation is enabled and the child has target
IDs; otherwise it becomes a manual task. Goods requests have no grant state.
The separate worker writes receipts, and a minute cron imports results; see
[deployment](DEPLOYMENT.md#queue-and-failure-handling). Neither Google credentials
nor browser responses are stored in these records.

### `time_grants`
Delivery jobs for purchased/redeemed chore time, legacy queued chore rewards, or direct parent bonuses. New chore earnings stay in `time_ledger` until redeemed. Parents may create standalone bonuses for their own kids (5–120 minutes in five-minute steps); hooks own giver/queue state. Kids read only their own jobs; household parents can read all their kids' jobs. Parents may confirm `manual` → `manual_done`; clients cannot delete jobs.

| Field | Type | Notes |
|-------|------|-------|
| child | relation → users | required |
| assignment | relation → assignments | unique when set; legacy rewards and new Use now redemptions |
| redemption | relation → time_redemptions | unique when set; server-created redemption delivery |
| given_by / request_key | relation → users / text | direct bonus giver (server-owned) and retry key; unique together when key is set |
| minutes | number | required; chore reward snapshot or direct parent bonus; 5–120 in steps of 5 |
| description | text | e.g. `Chore: Dishes (10 min bonus)` |
| grant_status | select(`queued`,`granted`,`manual`,`manual_done`,`cancelled`) | delivery states; cancellation only for provably unstarted saved-time reservations |
| grant_error | text | optional, max 300 |
| grant_delivered_seconds | number | server-owned successful delivery total; never changes the original reward |
| grant_dispatch_started | bool | permanent first-publication marker for redemptions; committed before any worker file is written |

### `time_ledger` and `time_redemptions`

`time_ledger` is immutable and server-written: `child`, `kind` (`earn`, `reserve`,
`redeem`, `release`), positive integer `minutes`, optional `assignment`/`redemption`,
unique `event_key`, and `created`. Available saved minutes = earns + releases −
reserves. Delivery (`redeem`) records history without charging again. An earn's
`earn:<assignment>` key snapshots the approved amount and prevents double awards.

`time_redemptions` stores `child`, `minutes`, `request_key`, `cancelled`, and
`created`; `(child, request_key)` is unique. Kids can read only their own records;
household parents can read their kids' records. Collection writes are closed to
clients. Authenticated kid-only routes own the transitions:

- `POST /api/paydirt/time-bank/redeem`: `minutes` (15–60 in 15-minute steps),
  `request_key`, optional `allow_queue`. A write transaction checks available
  funds, saves the reservation and creates one linked delivery grant. A retry
  returns the same redemption; a reused key with a different amount is rejected.
- `POST /api/paydirt/time-bank/cancel/{id}`: releases once only for a queued
  reservation whose permanent dispatch marker is still false. Publication commits that marker before writing a worker file.
  Manual, dispatched, partial, delivered, and uncertain outcomes cannot be cancelled.

Held minutes never expire or enter the worker queue on a window opening. Parent
approval awards them without another redemption approval or Grit charge. Use now
at submission explicitly consents to queueing outside allowed hours; later Use
time requires that confirmation. Queue expiry starts at redemption, under the
existing household policy. Existing queued grants are left intact. Parent totals
separate saved available, manual reservations, pending purchase requests, and queued
remainders in expanded details. Main Kids cards show only banked available time;
the per-child section starts collapsed with totals stacked when expanded. Both
kid layouts persist an uncertain redemption key across restarts.
Delivery receipts append one history event per delivered portion; server-side
status checks serialize cancellation and first publication. Manual tasks cannot be
released because a parent may already be granting them externally. Time-paying
approvals retain the existing undo prohibition, including held-only earnings.
Rollback refuses to remove a populated minute ledger.

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
cron prunes unarchived items older than 30 days. Archived alerts are retained; resolving their linked action still removes them. Deleting an item never affects real data.

| Field | Type | Notes |
|-------|------|-------|
| user | relation → users | owner; required |
| title | text | required |
| body | text | |
| type | text | push type, e.g. `broadcast`; `broadcast_sent` is the sending parent's copy |
| source | text | server-owned action target (`collection:id`); resolving/deleting the target removes its actionable alerts |

Assignment, suggestion, spend, help, broadcast-reply, and manual-grant actions
clear their linked reminders after success. Broadcast replies clear only the
replying child's reminder. Informational alerts remain dismissible. Older
unlinked alerts remain available for manual clearing; titles are not used to
guess which record an alert belongs to.

### `archives`
Personal display preferences, separate from the source records and ledger.
Each immutable row has a required `user` relation and exactly one source relation:
`inbox`, `kudos`, `assignment`, `spend_request`, or `time_grant`. Unique partial
indexes prevent duplicate archives for the same user/source. Source deletion
cascades to its archive row. Only the owner can list/view/delete the preference;
creation validates access and forces the current user as owner. Only approved
chores and settled screen-time grants are eligible; pending work stays visible.

Archive creation hides the item for that viewer; deleting the preference restores
it. Neither operation changes payout, acknowledgement, badge totals, or the
source record. Clients filter personal archive IDs while filling history pages,
so hidden records do not create empty pages or change another user's feed.
Archived views expand the original record instead of keeping a stale copy.
Migration rollback refuses while preferences remain; restore them first.

## Hooks (implemented)

Live in `pocketbase/pb_hooks/`. PocketBase runs each handler in an isolated VM, so shared helpers are `require()`'d **inside** each handler (see `lib/ntfy.js`).

1. **transaction → balance** (`currency.pb.js`): on `currency_transactions` create, increment `users.balance` by `amount`. Single point that maintains the cached balance.
2. **assignment approval → pay** (`currency.pb.js`): on `assignments` update to `approved`, pay by the chore's `pay_mode` (`lib/chorePay.js`): an `earn` transaction for `reward` (`bucks`/`both`) and/or an immutable `time_ledger` earn for `reward_minutes` (`time`/`both`). The assignment write transaction owns minute earning and any explicit Use now reservation. A `time`-only approval has no earn row, so the streak is refreshed directly (`computeStreak` counts minute-earn days and legacy chore-grant days, excluding later redemptions and direct parent bonuses). Known gap: weekly recaps, `ActivityReport` and ledger views total bucks from `currency_transactions`, so minutes don't appear there (chore counts, streaks and badges do count time chores).
3. **spend approval → spend** (`currency.pb.js`): on `spend_requests` update to `approved`, guard the balance first, then create a `spend` transaction for `−amount`. On API create, a request is forced `pending` with a positive `amount`; screen-time requests are priced server-side (client `amount` ignored).
4. **approval undo → reversal** (`currency.pb.js`): on `assignments` update *out of* `approved`, create a compensating `manual_adjustment` for the net of that assignment's own ledger rows (not the chore's current reward, which may have been edited). Undo is therefore a single status change; the ledger can't drift from the status. An assignment with a minute-earn ledger row or legacy `time_grants` row can't be undone (Family Link grants are additive); `guards.pb.js` blocks it by recorded earnings, not by the chore's current mode.
5. **kudos award → credit + notify** (`kudos.pb.js`): a parent-only, household-scoped award is normalized by the server, writes one linked `kudos` credit, and sends the recipient "Great work" push. A child may only mark their own unseen award as seen; all other fields stay immutable.
6. **ntfy notifications** (`notifications.pb.js`): fire on chore assigned, completed (→parent, except when a parent undoes an approval), approved/rejected (→child), spend submitted (→parent), spend resolved (→child), broadcast created (→all children). Set `NTFY_DISABLED=1` to suppress sends (use for test runs — the seeded topics are real public ntfy.sh topics).
7. **approval guard** (`guards.pb.js`): block non-parents from setting an assignment to `approved`/`rejected`/`closed`, from touching settled (`approved`/`closed`) assignments, and from invalid swap moves (owner can't reassign directly; the swap target may only accept or decline). Resubmitting a `rejected` chore requires a freshly uploaded photo, even when the chore doesn't normally need one. On `users`, a non-parent self-edit may change only `up_endpoint`/`ntfy_topic` (and their own password); every other field is parent-only.
8. **race close** (`races.pb.js`): first approval of a race chore closes every other open assignment for it and tells the losing kids who won.
9. **balance reactions** (`lib/balanceReactions.js`, called from `currency.pb.js` right after the balance update so it never reads a stale balance): on each ledger entry — mark crossed savings goals achieved (+notify), fire the one-time bank-threshold nudge, maintain `streak_count`, and grant streak milestone bonuses (3/7/14/30 days).
10. **engagement notifications** (`notifications.pb.js`): kid rejection replies and swap offers ping the relevant party; parent reactions ping the kid; proposals ping parents on create and the kid on resolve; a kid flagging `needs_help` pings parents. Every send is also logged to `inbox`.
11. **screen-time grants** (`familylink.pb.js`): protect submitted spending terms, settled decisions, and server-owned grant fields; approval sets the grant state and publishes committed purchases to the worker queue. Parents may confirm manual completion. `time_grants` (redeemed chore time and parent bonuses) use the same queue and states; the cron reconciles both collections.
12. **pay-mode validation** (`guards.pb.js` → `lib/chorePay.js`): every chore/template create or edit must pay something valid (reward above 0 for bucks, minutes in steps of 5 up to 120 for time) and stores only what the mode pays. Mirrors `packages/shared/src/chorePay.ts`.

## Cron jobs (`scheduler.pb.js` → `lib/scheduler.js`)

The single household's timezone (`grant_timezone`, default `America/Los_Angeles`) governs cron wall-clock schedules and calendar days, independently of the host/device timezone. Changes apply without restarting. Timestamps remain UTC; timers and expiry use elapsed time. Reports and date labels use household time.

Daily recurring limits reset at household midnight. A pending approval from yesterday does not block today's occurrence; existing unfinished/rejected work remains open. Assignment creation is transactional and retried each minute, including after downtime. Each daily chore gets at most one automatic occurrence per kid per day; parents can still override manually. Weekly/monthly rolling repeat windows are unchanged.

Manual triggers for tests/debugging: `POST /api/paydirt/cron/{tick|daily|digest|kid-recap|allowance}` (superuser only). All sends respect `NTFY_DISABLED` and skip `paused` households.
The separate Family Link reconciliation job lives in `familylink.pb.js`; it processes explicitly approved purchases regardless of household scheduling pauses.

| Job | Schedule | Does |
|-----|----------|------|
| paydirt_tick | every 10 min | approval nudges (`nudge_hours`), daily chore reminders (`reminder_time`), deadline escalation (`due_at`: 24h → 2h → overdue, parents pinged on overdue), kid one-shot reminders, per-kid chore summary (`digest_*`) |
| paydirt_recurring | every minute | create due recurring assignments, including the new daily occurrence after household midnight; preserve previous pending approvals |
| paydirt_daily | 03:00 | currency expiry (`expiry_days`, per-kid ledger replay oldest-first via `expiryLapse`, one compensating negative adjustment capped at balance), streak refresh (zeroes broken streaks), recurring chore auto-assignment (silent: `assignments.auto_created`, no per-chore push; re-creates assignments for recurring chores when no open one exists per kid) |
| paydirt_digest | Sun 18:00 | weekly per-kid summary (chores, earned/spent, balances, pending count) to parents |
| paydirt_kid_recap | Sun 10:00 | per-kid weekly ntfy recap (earnings, chores, nearest goal); skips `paused` households |
| paydirt_allowance | daily 06:00 | pays the scheduled allowance when due (`allowance_*`), notifies kids |
| paydirt_familylink | every minute | repair missed queue publication and import grant receipts; notify parents of manual recovery |

## Design decisions

- **Cached balance vs. computed**: balance is a cached field on `users`, kept correct by hook #1. The ledger remains the source of truth; transactions are append-only (no edits/deletes) so the cache can't drift. Voiding happens via compensating entries, never edits — approval undo (hook #4) is the canonical example.
- **Assignments carry status, no separate `completions` collection**: the status flow is enough. The race mechanic (first approval wins) is handled by `races.pb.js` closing losing assignments on the existing `assignments` collection.
- **Reward not snapshotted on assignment**: the `earn` transaction (and the `time_ledger` earn for minutes; legacy rewards use `time_grants`) records what was actually awarded, so it is the snapshot. Changing a chore's reward or pay mode later doesn't rewrite history.
