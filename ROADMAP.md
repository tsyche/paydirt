# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

## Recently Completed

1. ✅ **Real-time updates** — kid screens subscribe to their assignments + balance via PocketBase realtime (`subscribeToKidUpdates()`); approvals appear without pull-to-refresh; `react-native-sse` polyfill on mobile.
2. ✅ **Integration + API test suite** — 11 live tests for the shared client and every PB hook/guard (`make test-integration`) + Playwright golden path & broadcast UI for the dashboard (`make test-e2e`). Caught and fixed real bugs: double-undo deduction, unscoped household filters, wrong ledger labels, pre-existing ledger drift.
3. ✅ **Household broadcast** — `broadcasts` collection + ntfy fan-out hook; dashboard "Message all kids" control; parent-only by access rule.
4. **Android emulator dev tooling** — `make dev-all` starts everything (PB + web + Expo) with cache clear, emulator check, and health polling; `make stop` kills all services; `RESET=1` flag wipes and reseeds.
5. **Approval undo (hardened)** — undo is now a status change; a server hook writes the compensating ledger entry, making double-undo impossible and blocking kids from touching approved chores.

## Recommended Next 3

1. **Recurring chore auto-assignment** — the `cadence` field exists but nothing acts on it: "recurring" chores sit inert until a parent manually reassigns. A PocketBase cron (`cronAdd`) re-creates assignments on schedule (daily/weekly). Fixes a half-built feature and lays the cron foundation that nudges, reminders, and the weekly digest all reuse. ~2-3 hrs.
2. **Approval nudges** — ntfy reminder to parents when a chore sits awaiting approval >X hrs. Kids now see approvals instantly (realtime); this closes the other half of the loop. Rides the cron foundation from #1. ~1-2 hrs.
3. **Savings goals** — named goals with progress bars and a "goal reached" notification when the balance crosses the threshold. Biggest kid-facing motivator on the list; schema + hook + kid UI. ~3-4 hrs.

## Phase 1 — Core Feature Set

Status legend: ✅ done · ◑ partial (see [FEATURES.md](./FEATURES.md)) · ○ not started

- **Chores**: ○ one-off deadlines + escalating reminders, ✅ photo-required flag *(enforced server + client)*, ○ race mechanic (first kid wins), ○ kid-proposed chores
- **Currency**: ✅ configurable currency name, ○ bank thresholds (screen-time prompt), ✅ spontaneous bonus/deduction, ○ optional expiry (off by default), ○ physical goods exchange with configurable rate
- **Savings goals**: ○ named goals with progress bars, multiple goals, fulfilled notifications
- **Kid UX**: ○ glanceable home screen, ✅ chore history, ✅ simplified mode, ○ kid-added reminders
- **Parent UX**: ○ scheduled chore reminders, ○ approval nudges, ✅ approval undo, ✅ household broadcast, ○ approval reactions

## Phase 1.5 — Gamification & Reporting

- Streak bonuses (consecutive completions, milestone rewards) ~3-4 hrs
- Scheduled chore reminders (parent sets time per chore; PB cron fires ntfy to kid) ~2-3 hrs
- Weekly digest (parent summary via ntfy; reuses the cron foundation) ~2-3 hrs
- Lower priority: pause/vacation mode, chore swap between siblings

## Phase 2 — Family Link Automation

- Android Accessibility Service to auto-grant Bonus Time on spend approval
- Stretch: reverse-engineered Family Link API
- Manual fallback retained

## Phase 3 — Custom MDM

- Android Device Policy Controller; programmatic screen time without Family Link

## Phase 4 — Allowance / Payments

- Configurable reward types: in-app currency, Venmo, bank transfer, manual — all with in-app record-keeping

## Ideas (unscheduled)

- **Real-device test** — run on GrapheneOS/LineageOS. Emulator validated; real device is the remaining unknown. User-driven; Claude can help debug via adb.
- **Parent dashboard realtime** — subscribe the web dashboard the way the kid screens now do; drops the post-action reloads. Quick win now that `subscribeToKidUpdates` exists as a pattern. ~1-2 hrs.
- **Race mechanic** — chore assignable to multiple kids; first approval wins the reward. ~2-3 hrs.
- **One-command live test run** — make target that boots an ephemeral PocketBase on a scratch data dir (with `NTFY_DISABLED=1`), migrates, seeds, runs integration + e2e, tears down. Removes the "server must be running and seeded" setup step. ~1-2 hrs.
- **Kid-side broadcast history** — broadcasts are already stored; show the last few in the kid screens so a missed ntfy ping isn't lost. ~1 hr.
- **Notification quiet hours** — per-household window where ntfy sends are held or dropped (no 6am "chore approved" dings). ~1-2 hrs.
