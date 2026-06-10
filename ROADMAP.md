# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

## Recently Completed

1. **Android emulator dev tooling** — `make dev-all` starts everything (PB + web + Expo) with cache clear, emulator check, and health polling; `make stop` kills all services and force-quits the app on emulator; `RESET=1` flag wipes and reseeds.
2. **Photo upload fix** — replaced `fetch(uri).blob()` (crashes on Android) with FormData URI pattern; works on both `KidHome` and `SimpleKidHome` for photo-required chores.
3. **Approval undo** — "Recently approved" section in dashboard; Undo writes a compensating `manual_adjustment`; now surfaces errors instead of silently no-oping.
4. **Simplified mode** — `SimpleKidHome` with giant text/buttons for young kids; handles photo-required chores; branches on `simplified_mode` user field.
5. **Per-kid ledger + currency name** — `LedgerToggle` shows full transaction history; `currency_name` field on households with inline editor; propagated to all mobile/web views.

## Recommended Next 3

1. **Real-time updates** — kids currently must pull-to-refresh to see approvals; PocketBase subscription API in `KidHome`/`SimpleKidHome` makes it instant. ~2-3 hrs.
2. **Integration + API test suite** — PB hook tests (currency math, guards), shared client tests against live DB, Playwright for the parent dashboard golden path. User-requested; catches regressions before they reach the emulator. ~4-6 hrs.
3. **Household broadcast** — parent sends a one-liner to all kids via ntfy. Already have the ntfy wiring; minimal new code. ~1 hr.

## Phase 1 — Core Feature Set

Status legend: ✅ done · ◑ partial (see [FEATURES.md](./FEATURES.md)) · ○ not started

- **Chores**: ○ one-off deadlines + escalating reminders, ✅ photo-required flag *(enforced server + client)*, ○ race mechanic (first kid wins), ○ kid-proposed chores
- **Currency**: ✅ configurable currency name, ○ bank thresholds (screen-time prompt), ✅ spontaneous bonus/deduction, ○ optional expiry (off by default), ○ physical goods exchange with configurable rate
- **Savings goals**: ○ named goals with progress bars, multiple goals, fulfilled notifications
- **Kid UX**: ○ glanceable home screen, ✅ chore history, ✅ simplified mode, ○ kid-added reminders
- **Parent UX**: ○ scheduled chore reminders, ○ approval nudges, ✅ approval undo, ○ household broadcast, ○ approval reactions

## Phase 1.5 — Gamification & Reporting

- Streak bonuses (consecutive completions, milestone rewards) ~3-4 hrs
- Scheduled chore reminders (parent sets time per chore; PB cron fires ntfy to kid) ~2-3 hrs
- Approval nudges (ntfy reminder to parent if chore awaiting approval >X hrs) ~1-2 hrs
- Weekly digest (parent summary via ntfy) ~2-3 hrs
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

- **Household broadcast** — parent sends a message to all kids via ntfy. Zero infra cost. ~1 hr.
- **Real-device test** — run on GrapheneOS/LineageOS. Emulator validated; real device is the remaining unknown. User-driven; Claude can help debug via adb.
- **Savings goals** — named goals with progress bars; fulfilled notification when balance crosses threshold. ~3-4 hrs.
- **Race mechanic** — chore assignable to multiple kids; first approval wins the reward. ~2-3 hrs.
