# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

## Recently Completed

1. ✅ **Recurring chore auto-close (2026-06-16)** — `runDaily()` now respects `monthly` cadence (30-day gate), not just `weekly`. Previously any non-`weekly` cadence — including the UI-exposed `monthly` option — fell through to immediate same-day re-assignment. Added integration tests for weekly and monthly (daily was already covered).
2. ✅ **Photo proof viewer (2026-06-15)** — parent approval cards (web + mobile) show the photo thumbnail inline via `client.getPhotoUrl()`; no more jumping to PocketBase admin.
3. ✅ **Kid-proposed chore auto-assign (2026-06-15)** — already worked on web (`approveProposal()`); built the missing mobile parent UI (CHORE IDEAS section, approve/decline, reward prompt) for parity.
4. ✅ **Fixed: PocketBase couldn't boot from a clean `pb_data` (2026-06-16)** — three latent bugs, only surfaced once `pb_data` was wiped to absolute zero: (a) custom `users.avatar` field collided with PocketBase's newer built-in `avatar` file field — renamed to `avatar_emoji` across migration + all call sites; (b) `1717000010_chore_templates.js` and `1717000011_household_quiet_hours.js` still used the pre-0.23 `Dao`/`SchemaField` API, removed in the installed PocketBase 0.39.3 — rewritten with the current `Collection`/`*Field` API used by every other migration.
5. ✅ **Per-kid goods rate (2026-06-15)** — `users.goods_rate` override field (migration `1717000013`). Dashboard edit control per kid; balance and spend request displays in web + both mobile screens use kid rate, falling back to household rate.

<details>
<summary>Earlier completions (2026-06-14 — 2026-06-15)</summary>

- Web chore edit, custom kid reminder times, parent mobile chore creation + sibling leaderboard
- `withUnifiedPush.js` lint fixes, multi-kid chore assignment, parent earnings/activity report, streak/expiry tuning UI
- Notification quiet hours, chore templates, parent mobile view (approvals/spend/broadcast)
- MD3 design overhaul (web + mobile), kid avatar + color

</details>

## Known issues

- **Flaky/broken e2e tests** — `golden-path.spec.ts` has 2 pre-existing failures (not caused by recent work, verified against the prior commit too): a `.balance` CSS-class locator that resolves to 4 elements instead of 1 (selector needs to scope more precisely — too many unrelated elements share the class), and a "📣 Send" broadcast button the test can't find within 30s. Worth a dedicated fix pass.

## Recommended Next 3

1. **Currency ledger CSV export** — web dashboard button to download a kid's transaction history (already in `LedgerToggle`) as CSV; useful for record-keeping or tax-adjacent allowance tracking. ~1 hr.
2. **Mobile chore template parity** — `ChoreTemplatesPanel` exists on web only; ParentHome's create-chore form has no "use template" / "save template" option. ~1 hr.
3. **Fix golden-path.spec.ts e2e flakiness** — see Known issues above. ~30 min.

## Phase 1 — Core Feature Set ✅ (completed 2026-06-10)

- **Chores**: ✅ one-off deadlines + escalating reminders, ✅ photo-required flag, ✅ race mechanic (first approval wins), ✅ kid-proposed chores, ✅ recurring cadence selector in web UI
- **Currency**: ✅ configurable currency name, ✅ bank thresholds, ✅ spontaneous bonus/deduction, ✅ optional expiry (off by default), ✅ physical goods exchange rate (conversion display)
- **Savings goals**: ✅ named goals with progress bars, multiple goals, fulfilled notifications
- **Kid UX**: ✅ glanceable home screen (balance + to-do count + streak + due chips), ✅ chore history (collapsible, capped), ✅ simplified mode, ✅ kid-added reminders
- **Parent UX**: ✅ scheduled chore reminders, ✅ approval nudges, ✅ approval undo, ✅ household broadcast, ✅ approval reactions

## Phase 1.5 — Gamification & Reporting ✅ (completed 2026-06-10)

- ✅ Streak bonuses (3/7/14/30-day milestones, 🔥 shown in both apps)
- ✅ Weekly digest (Sunday 6pm ntfy summary to parents)
- ✅ Pause/vacation mode (suspends reminders, nudges, digest, expiry)
- ✅ Chore swap between siblings (offer → accept/decline, server-guarded)

## Phase 2 — Family Link Automation

- Android Accessibility Service to auto-grant Bonus Time on spend approval
- Stretch: reverse-engineered Family Link API
- Manual fallback retained

## Phase 3 — Custom MDM

- Android Device Policy Controller; programmatic screen time without Family Link

## Phase 4 — Allowance / Payments

- Configurable reward types: in-app currency, Venmo, bank transfer, manual — all with in-app record-keeping

## Ideas (unscheduled)

- **UnifiedPush self-hosted ntfy** — when ready to move off ntfy.sh, re-register on device → new endpoint URL encodes the self-hosted server automatically. No server-side config needed.
