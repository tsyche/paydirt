# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

## Recently Completed

1. ✅ **Kid avatar + display name color (2026-06-14)** — Emoji avatar + accent color per kid; set by parent via AvatarControl in web dashboard; shown as colored left border + emoji on kid cards, and in mobile screens (SimpleKidHome balance icon, KidHome appbar). PocketBase migration adds `avatar` + `color` fields.
2. ✅ **Batch approval (2026-06-14)** — Select multiple pending completions and approve all at once; checkboxes + "Approve selected (N)" / "Approve all" buttons appear when 2+ completions are pending.
3. ✅ **UnifiedPush via ntfy (2026-06-14)** — Event-driven kid notifications replace 30s polling. BroadcastReceiver handles UP intents natively; endpoint stored per-user in PocketBase; hooks push to kids for all events. Config plugin re-applies after `expo prebuild`. Falls back to polling service on first launch.
4. ✅ **Recurring chore cadence selector in UI (2026-06-14)** — Web dashboard CreateChore form now shows a daily/weekly/monthly select when type is "recurring". Cadence displayed in the chore list alongside type.
5. ✅ **Dollar value display (2026-06-14)** — `goods_rate` shows `$X.XX` alongside parentBucks on all kid screens and next to each kid in the parent dashboard.

## Recommended Next 3

1. **Parent mobile view** — Parents currently see a "go use the web dashboard" screen. Basic mobile parent experience: view pending approvals, approve/reject, send a broadcast. Unblocks parents from needing a laptop for routine tasks. ~4-6 hrs.
2. **Mobile UI design polish** — Full visual pass on all kid-facing screens using the `frontend-design` skill. Fix layout gaps, button feedback, error states, spacing. High engagement impact before real kids start using it. ~3-5 hrs.
3. **Chore templates** — Household-level library of reusable chore definitions; creating a new chore picks from the library. Reduces setup friction as chore count grows. ~2-3 hrs.

**Also queued:** Notification quiet hours (~1-2 hrs), per-kid goods rate (~1 hr), multi-kid chore assignment (~1-2 hrs).

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

- **Chore templates** — household-level library of reusable definitions. Creating a new chore picks from the library. ~2-3 hrs.
- **Parent earnings/activity report** — monthly summary (or exportable CSV): per-kid totals for chores completed, earned, spent, streak peak. ~2-3 hrs.
- **Notification quiet hours** — per-household window where ntfy sends are held/dropped (no 6am pings). ~1-2 hrs.
- **Custom kid reminder times** — freeform time input in addition to the 1h/3h/tomorrow presets. ~1 hr.
- **Streak/expiry tuning UI** — milestone amounts hard-coded in `lib/streaks.js`; surface in household settings. ~1-2 hrs.
- **Multi-kid chore assignment** — currently one kid at a time; checkbox list would speed up race chore setup. ~1-2 hrs.
- **Per-kid goods rate** — `goods_rate` is household-wide; `users.goods_rate` with fallback to household rate would let kids at different ages have different conversion displays. ~1 hr.
- **UnifiedPush self-hosted ntfy** — when ready to move off ntfy.sh, re-register on device → new endpoint URL encodes the self-hosted server automatically. No server-side config needed.
