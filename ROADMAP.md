# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

**Still needed before real-device use:**
- On-device verification on GrapheneOS/LineageOS (user-driven; Claude can help debug via adb).

## Recently Completed

1. **Per-kid ledger view** — `LedgerToggle` per kid in parent dashboard; shows date, type, amount, reason from `currency_transactions`.
2. **photo_required enforcement** — server guard rejects completion without photo; `KidHome` shows "Take photo & mark done" button; `expo-image-picker` handles camera.
3. **Approval undo** — "Recently approved" section in dashboard; Undo writes a compensating `manual_adjustment`; `reverseApproval()` in shared client.
4. **Simplified mode UI** — `SimpleKidHome` screen with giant text/buttons; `App.tsx` branches on `simplified_mode`.
5. **Bonus/deduction UI** — `AdjustControl` per kid in the parent dashboard; calls `adjustBalance()`.

## Recommended Next 3

1. **On-device test** — run on a real GrapheneOS/LineageOS device. Everything else is moot if it crashes there. User-driven; Claude can help debug via adb.
2. **Kid chore history in mobile app** — read-only list of past approved chores in `KidHome`; builds pride and answers "what did I earn?" ~1-2 hrs.
3. **Configurable currency name per household** — small field on households + parent dashboard UI. Lets the family rename "parentBucks" to something fun. ~1-2 hrs.

## Phase 1 — Core Feature Set

Status legend: ✅ done · ◑ partial (see [FEATURES.md](./FEATURES.md)) · ○ not started

- **Chores**: ○ one-off deadlines + escalating reminders, ✅ photo-required flag *(enforced server + client)*, ○ race mechanic (first kid wins), ○ kid-proposed chores
- **Currency**: ○ bank thresholds (screen-time prompt), ✅ spontaneous bonus/deduction, ○ optional expiry (off by default), ○ physical goods exchange with configurable rate
- **Savings goals**: ○ named goals with progress bars, multiple goals, fulfilled notifications
- **Kid UX**: ○ glanceable home screen, ○ chore history/portfolio, ✅ simplified mode, ○ kid-added reminders
- **Parent UX**: ○ scheduled chore reminders, ○ approval nudges, ○ household broadcast, ○ approval reactions

## Phase 1.5 — Gamification & Reporting

- Streak bonuses (consecutive completions, milestone rewards)
- Weekly digest (parent summary via ntfy/email)
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

- **Configurable currency name per household** — small config field + UI. Lets kids name their own currency. ~1-2 hrs.
- **Kid chore history** — read-only list of past completed/approved chores in the kid app. Builds pride. ~2 hrs.
- **Household broadcast** — parent sends a message to all kids via ntfy. Zero infra cost. ~1 hr.
