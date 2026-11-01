# Bonus minutes and kid time asks

**Status:** Building. Per-chore pay mode is built locally (2026-10-31, uncommitted/undeployed); the ask button, suggestions, nudges and caps stay deferred.
**Fold into:** [DATA_MODEL.md](../DATA_MODEL.md), [FEATURES.md](../../FEATURES.md), [DEPLOYMENT.md](../DEPLOYMENT.md#family-link-grants)

**TL;DR:** Kids ask for more time constantly. Instead of a free handout, an ask becomes a trigger: the parent replies with a chore that pays bonus screen minutes on top of its normal bucks. The same `bonus_minutes` field also lets any chore carry a permanent time win. Grants reuse the Family Link queue through a new `time_grants` collection, not fake spend requests.

## Built: per-chore pay mode (2026-10-31)

- `pay_mode` (`bucks`/`time`/`both`) + `reward_minutes` on `chores` and `chore_templates`; `reward` is no longer required (a time-only chore pays 0).
- Approval pays by mode: earn transaction and/or a `time_grants` row, granted through the generalized Family Link queue (worker accepts 5-120 min in 5-min steps).
- **No assignment snapshot** (changed from the original draft): like `reward`, the earn row and the `time_grants` row are the snapshot, so editing a chore only affects future approvals.
- Undo now reverses the net of the assignment's own ledger rows (it used the chore's current reward, a latent bug), and is blocked once a time grant exists.
- Time-only approvals still count toward streaks. Web + mobile forms, badges and grant lists; tests in `chorePay.test.ts`, `hooks.integration.test.ts`, `familylinkQueue*.test.ts` and the web e2e.
- **Rollout:** don't create `time`/`both` chores on bb until the new APK is on both tablets (old builds show '+0'), and don't ship before the first real 15-minute purchase has completed on the current build.

## Decisions (original draft; ask/offer parts still deferred)

- **Ask is free and not a currency event.** The kid taps 'Ask for more time' (optional note). Parents get a push and an inbox item.
- **Reply is one tap:** offer a chore with bonus minutes, deny with a preset reason, or give a small amount directly.
- **Bonus is on top of bucks, never instead of them.** A chore pays its normal reward plus `bonus_minutes`.
- **Per-chore default, per-assignment snapshot.** `chores.bonus_minutes` (default 0, so nothing changes until set) is copied to `assignments.bonus_minutes` at assign time. Later chore edits don't change what a kid was promised, matching how spend terms are immutable. A parent offering a chore to a kid who asked just sets or edits `bonus_minutes` on that assignment.
- **Nudges are parent-triggered, never automatic.** Household settings: nudges on/off, max nudges per day, quiet hours (already exist), and a daily bonus-minutes cap per kid.
- **New `time_grants` collection**, not `spend_requests` with amount 0. A fake spend would need bypasses around the positive-amount guard, the approval-time `-amount` ledger transaction, and the immutable-terms rule, and would show up as a purchase in both apps.

## Deferred or rejected (and why)

- **Kid picks bucks or time.** At `screen_rate` the two are equal value, so choosing time just auto-spends bucks. It saves the kid one request step they already have, and the 6-year-old would always pick time, starving banking, goals and goods. Revisit as a per-chore 'kid's choice' mode only if asking stays constant after v1.
- **Staleness premium** (pay more for chores nobody has done lately). Rewards neglect. If added later, keep it small, capped, and based on the household rather than the kid.
- **Automatic nudges.** Kids learn to wait for offers and stop doing chores at normal prices.
- **LLM suggestions.** 'Smart' means a ranked query, below.

## Why not reuse the queue as-is

[`lib/familylink.js`](../../pocketbase/pb_hooks/lib/familylink.js) is hard-wired to `spend_requests`: `reconcile` filters `status = 'approved' && grant_status = 'queued'`, and `prepare`, `publish` and `notifyManual` read `screen_minutes` and `description` from that record type. The worker job itself (`id`, `childId`, `deviceId`, `seconds`) is generic, and the receipt is keyed by record id, so the worker needs no change. The refactor is to make the hooks collection-agnostic and run `reconcile` over both collections.

## Phases

| Phase | Scope | Rough effort |
|-------|-------|--------------|
| v1 | Ask button (KidHome + SimpleKidHome), parent reply sheet (web + mobile), `bonus_minutes` on chores and assignments, `time_grants` + generalized Family Link hooks, approval grants minutes, ntfy for ask/offer/result, household cap | 12-16 hrs |
| v2 | Suggested chores and minutes on the reply sheet: rank by days since the household last completed the chore, skip already-assigned, filter by kid; minutes = chore bucks / `screen_rate`, rounded to 5, editable | ~4 hrs |
| v3 | Parent-triggered nudge ('do this, get time') with per-day cap, using the same offer entity as the ask reply | ~4 hrs |

Ship v1 and watch whether asking drops before building v2/v3. Estimates are unverified.

## Rules to implement in v1

- **Approval:** a bonus assignment approval writes the normal earn transaction and creates a `time_grants` row (`queued` or `manual`, same rules as purchases). Streaks count the completion either way.
- **Undo:** Family Link grants are additive and can't be clawed back. Disable approval-undo for assignments with `bonus_minutes > 0`, or warn and reverse only the bucks. Prefer disabling.
- **Daily cap:** one total per kid covering purchased and bonus minutes, so the cap can't leak. Check first whether purchased time has a cap today; if not, define it here.
- **Guards, all server-side:** one open ask per kid, a cooldown between asks, bonus minutes in multiples of 5, no grant when the cap would be exceeded (convert to a plain no-bonus approval).
- **Kid UI:** the 6-year-old can read, but a denied ask still needs an icon-and-color state, not just a reason string.

## Tests

- **Unit:** minutes rounding and cap math (shared package), suggestion ranking (v2).
- **Integration (live PB):** snapshot immutability, approval creates exactly one `time_grants` row, cap enforcement, ask guards, undo blocked, `verify-ledger` unaffected.
- **E2E:** ask → offer → complete → approve → grant row visible, on the Playwright dashboard.
- **Queue:** `reconcile` handles both collections without double-publishing a job (receipt keyed by id).

## Open questions

- Does purchased screen time already have a daily cap? (Not checked. Time chores are uncapped except the advisory `max_per_period`.)
- Does the existing parent 'grant bonus' button stay as the direct give-a-few-minutes path, or fold into the reply sheet?
