# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

## Recently Completed

1. ✅ **Currency ledger CSV export (2026-06-16)** — "Export CSV" button in the web `LedgerToggle`; downloads a kid's full transaction history. `buildLedgerCsv` extracted as a pure function with 7 unit tests.
2. ✅ **Mobile chore template parity (2026-06-16)** — `ParentHome` now shows a collapsible template picker and "Save as template" button matching the web `ChoreTemplatesPanel`. Integration test covers create/list/delete.
3. ✅ **golden-path.spec.ts e2e fixes (2026-06-16)** — fixed `.balance` → `.kid-balance` (too-broad CSS selector) and corrected "📣 Send" → "Send" button name mismatch.
4. ✅ **Recurring chore auto-close (2026-06-16)** — `runDaily()` now respects `monthly` cadence (30-day gate), not just `weekly`. Added integration tests for weekly and monthly cadences.
5. ✅ **Photo proof viewer + mobile proposal parity (2026-06-15)** — parent approval cards show photo inline; mobile parent got CHORE IDEAS section (approve/decline, reward prompt).

<details>
<summary>Earlier completions (2026-06-10 — 2026-06-15)</summary>

- Per-kid goods rate, web chore edit, custom kid reminder times, parent mobile chore creation + sibling leaderboard
- `withUnifiedPush.js` lint fixes, multi-kid chore assignment, parent earnings/activity report, streak/expiry tuning UI
- Notification quiet hours, chore templates, parent mobile view (approvals/spend/broadcast)
- MD3 design overhaul (web + mobile), kid avatar + color
- Phase 1 + 1.5 features: races, savings goals, streaks, chore swap, weekly digest, vacation mode

</details>

## Known Issues

_None currently._

## Recommended Next 3

1. **Real-device smoke test** — emulator works; GrapheneOS/LineageOS hasn't been validated. Prerequisite for Phase 2. Run the full flow (login → chore → complete → approve → spend) on a physical device over wireless adb. ~2 hrs.
2. **Chore edit on mobile** — `client.updateChore()` exists but `ParentHome` has no edit UI. Web has it; mobile parents can only deactivate. ~1-2 hrs.
3. **Due date on mobile create-chore form** — `due_at` field exists and is displayed to kids (due chip) and handled by cron (escalating reminders), but `ParentHome`'s create-chore form has no date picker. Use `@react-native-community/datetimepicker` (already in Expo SDK). ~1 hr.

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

**Status: not started. Prerequisite: real-device smoke test passes.**

The notification pipeline (`UnifiedPushReceiver.kt` + `up_endpoint` server-side delivery) is complete and working. What's missing is the Android Accessibility Service that watches for spend-approval notifications and programmatically taps Family Link's "Grant Bonus Time" UI.

- **Android AccessibilityService** — watches for spend-approval notifications; auto-taps Family Link's "Grant Bonus Time" button. Needs Kotlin native code + AndroidManifest wiring. ~1-2 days.
- **Stretch: reverse-engineered Family Link API** — direct HTTP grant without the Accessibility Service; fragile but faster UX.
- **Manual fallback** — retained regardless; users who don't have/need Family Link still get the approval flow.

**Honest estimate: 2-4 days of native Android work after real-device validation.**

## Phase 3 — Custom MDM

- Android Device Policy Controller; programmatic screen time without Family Link

## Phase 4 — Allowance / Payments

- Configurable reward types: in-app currency, Venmo, bank transfer, manual — all with in-app record-keeping

## Backlog (unscheduled)

- **Notification deep links** — tapping a push notification opens the relevant screen (e.g. approval notification → approvals section). Currently notifications are fire-and-forget with no intent payload. Needs `PendingIntent` in `UnifiedPushReceiver.kt` + React Native Linking. ~2-3 hrs.
- **Second parent support** — currently one parent per household is the implicit assumption (no UI to invite/add a co-parent). Schema supports multiple `parent`-role users per household; needs an invite flow. ~3-4 hrs.
- **UnifiedPush self-hosted ntfy** — when ready to move off ntfy.sh, re-register on device → new endpoint URL encodes the self-hosted server automatically. No server-side config needed.
- **iOS build** — Expo project is cross-platform; main blocker is Apple developer account + TestFlight distribution. No code changes needed.
