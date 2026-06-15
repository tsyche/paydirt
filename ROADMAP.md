# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

## Recently Completed

1. ✅ **UnifiedPush via ntfy (2026-06-14)** — Event-driven kid notifications replace 30s polling. BroadcastReceiver handles UP intents natively; endpoint stored per-user in PocketBase; hooks push to kids for all events (new chore, approved/rejected, broadcast, spend/proposal resolved). Config plugin re-applies after `expo prebuild`. Falls back to polling service on first launch.
2. ✅ **Recurring chore cadence selector in UI (2026-06-14)** — Web dashboard CreateChore form now shows a daily/weekly/monthly select when type is "recurring". Cadence displayed in the chore list alongside type.
3. ✅ **Dollar value display (2026-06-14)** — `goods_rate` shows `$X.XX` alongside parentBucks on all kid screens and next to each kid in the parent dashboard.
4. ✅ **Photo upload fix (2026-06-14)** — Switched to base64 data URI to fix `ClientResponse 0` crash on Android 13+ camera.
5. ✅ **Dark mode + Android 16 crash fix (2026-06-13)** — Dynamic MD3 theme; `useTheme()` tokens across all screens; foreground service type declaration fixed for targetSdk 36.

## Recommended Next 3

1. **Batch approval** — Select multiple pending completions and approve/reject at once. High-value as chore count grows; server already handles individual approvals atomically. ~1-2 hrs.
2. **Kid avatar / display name color** — Pick a color or emoji avatar shown on both apps. Low effort, high kid engagement. ~1-2 hrs.
3. **Parent mobile view** — Parents currently see a "go use the web dashboard" screen. Basic mobile parent experience: view pending approvals, approve/reject, send a broadcast. Unblocks parents from needing a laptop for routine tasks. ~4-6 hrs.

**Also queued:** Mobile UI design polish (full visual pass, kid-facing screens, `frontend-design` skill) — ~3-5 hrs.

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
