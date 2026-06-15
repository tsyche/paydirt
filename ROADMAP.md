# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

## Recently Completed

1. ✅ **Parent mobile chore creation (2026-06-15)** — Create-chore form added to ParentHome (name, reward, type/cadence, photo-required, race, reminder time) with collapsible toggle. Chore list below with tap-to-toggle kid chips for direct assignment.
2. ✅ **Kid leaderboard / achievement wall (2026-06-15)** — Collapsible "🏆 Sibling leaderboard" accordion in KidHome. Shows each sibling sorted by streak (avatar, name, streak count, last 3 wins). Fetched lazily on expand; balances never exposed.
3. ✅ **Multi-kid chore assignment (2026-06-15)** — `AssignControl` replaced with per-kid checkboxes; parents tick any subset and assign in one action. Race mechanic still driven by chore's `race` flag on backend.
2. ✅ **Parent earnings/activity report (2026-06-15)** — Collapsible 📊 section in the web dashboard. Per-kid monthly cards: chores completed, earned, spent, streak peak (computed from consecutive approved days). Month/year navigation. Two new client methods: `listTransactionsForMonth`, `listApprovedAssignmentsForMonth`.
3. ✅ **Streak/expiry tuning UI (2026-06-15)** — Milestone bonus amounts now overridable per household via HouseholdSettings (3/7/14/30-day). Migration `1717000012` adds `streak_bonus_N` fields; `goals.pb.js` reads household overrides, falls back to hardcoded defaults when 0/unset.
4. ✅ **Notification quiet hours (2026-06-15)** — Per-household window where all push notifications are suppressed. `quiet_start`/`quiet_end` (HH:MM) fields on households; `isQuietHours()` check in `ntfy.js` before every send; time pickers in HouseholdSettings; handles midnight wrap-around.
5. ✅ **Chore templates (2026-06-15)** — Household-level reusable chore library. `chore_templates` PocketBase collection; `listTemplates`/`createTemplate`/`deleteTemplate` client methods; web dashboard shows collapsible template panel with "Use" (pre-fills form) and "Save template" button on CreateChore.
6. ✅ **Parent mobile view (2026-06-15)** — Full MD3 parent home screen replacing the placeholder. Pending approvals (approve/reject/batch), spend requests, kids balance overview, household broadcast; real-time via `subscribeToDashboardUpdates`; pull-to-refresh.
7. ✅ **MD3 design overhaul — web + mobile (2026-06-14)** — Material Design 3 visual system across all screens. Full CSS token set (light + dark), DM Sans/DM Mono fonts, elevation, shape, tonal surfaces. Mobile: Login, ParentNotice, SimpleKidHome, KidHome polished with MD3 components, avatar/color band on balance cards.
8. ✅ **Kid avatar + color (2026-06-14)** — Emoji avatar + accent color per kid; set by parent via AvatarControl; shown on kid cards (web), balance header band (mobile), and throughout both apps.

## Recommended Next 3

1. **Per-kid goods rate** — `goods_rate` is household-wide; `users.goods_rate` with fallback to household rate would let kids at different ages have different conversion displays. ~1 hr.
2. **Custom kid reminder times** — freeform time input in addition to the 1h/3h/tomorrow presets; currently not exposed on mobile. ~1 hr.
3. **Fix `withUnifiedPush.js` lint errors** — pre-existing `expo-file-system` API mismatch and `require()` import style; blocking clean lint runs. ~30 min.

**Also queued:** Per-kid goods rate (~1 hr).

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

- **Parent mobile: chore creation** — currently web-only; completing the mobile parent experience so parents can add chores from the phone. ~2 hrs.
- **Parent earnings/activity report** — monthly summary (or exportable CSV): per-kid totals for chores completed, earned, spent, streak peak. ~2-3 hrs.
- **Custom kid reminder times** — freeform time input in addition to the 1h/3h/tomorrow presets. ~1 hr.
- **Streak/expiry tuning UI** — milestone amounts hard-coded in `lib/streaks.js`; surface in household settings. ~1-2 hrs.
- **Multi-kid chore assignment** — currently one kid at a time; checkbox list would speed up race chore setup. ~1-2 hrs.
- **Per-kid goods rate** — `goods_rate` is household-wide; `users.goods_rate` with fallback to household rate would let kids at different ages have different conversion displays. ~1 hr.
- **Kid leaderboard / achievement wall** — siblings can see each other's streak and recent wins; light gamification without exposing balances. ~2-3 hrs.
- **UnifiedPush self-hosted ntfy** — when ready to move off ntfy.sh, re-register on device → new endpoint URL encodes the self-hosted server automatically. No server-side config needed.
