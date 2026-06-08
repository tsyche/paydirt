# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## MVP — Ship It and Use It

Smallest useful version: chore CRUD, assignment, complete/approve flow, parentBucks earn + spend requests, ntfy notifications, optional photo proof. See [FEATURES.md](./FEATURES.md).

## Phase 1 — Core Feature Set

- **Chores**: one-off deadlines + escalating reminders, photo-required flag, race mechanic (first kid wins), kid-proposed chores
- **Currency**: bank thresholds (screen-time prompt), spontaneous bonus/deduction, optional expiry (off by default), physical goods exchange with configurable rate
- **Savings goals**: named goals with progress bars, multiple goals, fulfilled notifications
- **Kid UX**: glanceable home screen, chore history/portfolio, simplified mode (default on for youngest), kid-added reminders
- **Parent UX**: scheduled chore reminders, approval nudges, household broadcast, approval reactions

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
