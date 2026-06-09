# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped (code-complete)

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated).

**Before it's truly usable (do these first):**
1. On-device verification of the mobile app (Expo dev build for GrapheneOS/LineageOS, not just emulator).
2. ✅ Live ntfy send — topics set on all test users; notifications confirmed delivered to ntfy.sh end-to-end.

## Recommended next 3

1. ✅ **ntfy topic setup + live test** — topics set and confirmed working end-to-end (hooks fire → ntfy.sh receives).
2. ✅ **Spend bonus/deduction button in the dashboard** — `AdjustControl` component per kid; calls `adjustBalance()`, reloads on submit.
3. ✅ **Simplified mode UI for the 6-year-old** — `SimpleKidHome` screen with giant text/buttons; `App.tsx` branches on `user.simplified_mode`.

## Phase 1 — Core Feature Set

Status legend: ✅ done · ◑ partial (see [FEATURES.md](./FEATURES.md)) · ○ not started

- **Chores**: ○ one-off deadlines + escalating reminders, ◑ photo-required flag *(schema only — not enforced)*, ○ race mechanic (first kid wins), ○ kid-proposed chores
- **Currency**: ○ bank thresholds (screen-time prompt), ✅ spontaneous bonus/deduction *(AdjustControl UI + API)*, ○ optional expiry (off by default), ○ physical goods exchange with configurable rate
- **Savings goals**: ○ named goals with progress bars, multiple goals, fulfilled notifications
- **Kid UX**: ○ glanceable home screen, ○ chore history/portfolio, ✅ simplified mode *(SimpleKidHome screen; branches on `simplified_mode` field)*, ○ kid-added reminders
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

Cheap, high-value adds that ride on data/infra already in place:

1. **Per-kid ledger view** — read-only transaction history in the dashboard (and kid app). The `currency_transactions` data already exists; this is pure presentation. Answers "where did my parentBucks go." ~2-3 hrs.
2. **Configurable currency name per household** — the plan calls for it; small config field + UI. Lets kids name their own currency (high delight, low cost). ~1-2 hrs.
3. **Approval undo (reversing entry)** — a mis-approval is currently permanent (append-only ledger). Add a parent "reverse" action that writes a compensating `manual_adjustment` rather than editing history. Keeps the ledger clean. ~2-3 hrs.
