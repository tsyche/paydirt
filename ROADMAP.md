# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

## Recently Completed

1. ✅ **Per-kid goods rate (2026-06-15)** — `users.goods_rate` override field (migration `1717000013`). Dashboard edit control per kid; balance and spend request displays in web + both mobile screens use kid rate, falling back to household rate. Parent mobile spend cards also now use per-kid rate (parity with web).
2. ✅ **Web chore edit (2026-06-15)** — Inline ✏️ edit button on every chore row expands to a full edit form (name, reward, type/cadence, photo, race, reminder). Archive button soft-deletes (sets `active: false`). No delete-and-recreate required.
3. ✅ **Custom kid reminder times (2026-06-15)** — RemindDialog gains a freeform HH:MM text input alongside the 3 presets. Parses to today's date at that time, rolling to tomorrow if already past. Also added "In 30 min" preset.
4. ✅ **Fix `withUnifiedPush.js` lint errors (2026-06-15)** — `plugins/` excluded from ESLint (CJS config plugins must use `require()`). `lib/unifiedpush.ts` migrated from removed `FileSystem.documentDirectory` to new `expo-file-system` v56 `File`/`Paths` API. Lint and tsc both clean.
3. ✅ **Parent mobile chore creation (2026-06-15)** — Create-chore form added to ParentHome (name, reward, type/cadence, photo-required, race, reminder time) with collapsible toggle. Chore list below with tap-to-toggle kid chips for direct assignment.
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

1. **Photo proof viewer** — parent approval cards show the photo thumbnail if one was attached; currently parents have to navigate to PocketBase admin to see it. ~1 hr.
2. **Kid-proposed chore auto-assign** — when a parent approves a proposal, prompt to immediately assign it back to the proposing kid. ~30 min.
3. **Recurring chore auto-close** — approved recurring assignments should close and re-open on their cadence automatically; currently parents must manually re-assign each cycle. ~2 hrs.

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

- **Photo proof viewer** — parent approval cards show the photo thumbnail; currently parents have to navigate to PocketBase admin to see it. ~1 hr.
- **Recurring chore auto-close** — approved recurring assignments should close and re-open on cadence automatically; currently parents must manually re-assign. ~2 hrs.
- **Kid-proposed chore auto-assign** — when a parent approves a proposal, prompt to immediately assign it to the proposing kid. ~30 min.
- **UnifiedPush self-hosted ntfy** — when ready to move off ntfy.sh, re-register on device → new endpoint URL encodes the self-hosted server automatically. No server-side config needed.
