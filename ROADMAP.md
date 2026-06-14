# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

## Recently Completed

1. ✅ **Dollar value display (2026-06-14)** — `goods_rate` (bucks per $1) now shows `$X.XX` alongside parentBucks balance on all kid screens (KidHome, SimpleKidHome) and next to each kid in the parent dashboard. Rate is household-wide, configurable in ⚙️ Settings. Seed defaults to 10 PB = $1.
2. ✅ **Photo upload fix (2026-06-14)** — Switched from FormData file URI to base64 data URI (JSON). Fixes `ClientResponse 0` crash on Android 13+ where `content://` URIs from the camera couldn't be read by the native HTTP client. Guard updated to accept data URIs as new uploads; snack extended to 5s so errors are readable.
3. ✅ **Dark mode + Android 16 crash fix (2026-06-13)** — Dynamic theme via `useColorScheme()` + `MD3DarkTheme`; hardcoded hex colors replaced with `useTheme()` tokens across all mobile screens. Fixed `InvalidForegroundServiceTypeException` on targetSdk 36 by declaring `foregroundServiceType="dataSync"` and passing it as an array to the library.
4. ✅ **Standalone APK + real-device testing (2026-06-13)** — Sideloadable debug APK (no Metro); `debuggableVariants = []` in build.gradle; Gradle 9.3.1 pinned; New Architecture disabled; PocketBase bound to `0.0.0.0:8090` for LAN access. Tested on GrapheneOS / Android 16.
5. ✅ **Native push notifications via background service (2026-06-11)** — EAS/standalone APK build pipeline; foreground service polls PocketBase every 30s; notifications appear from PayDirt (not ntfy); ntfy kept for parent web alerts only.

## Recommended Next 3

1. **Mobile UI design polish** — Full visual pass on all kid-facing screens (KidHome, SimpleKidHome, Login, ParentNotice). Fix layout gaps, button feedback, error states, and spacing. Use `frontend-design@claude-plugins-official` skill. ~3-5 hrs.
2. **UnifiedPush fast follow** — Replace the foreground polling service with event-driven push via ntfy (UnifiedPush distributor already installed on device). Eliminates the persistent "Watching for chore updates" indicator. Requires: `up_endpoint` field on users, PocketBase hooks to POST to UP endpoint, native Android BroadcastReceiver (via Expo Config Plugin), JS registration on login. Self-hosted ntfy migration is transparent — endpoint URL encodes the server. ~1 day.
3. **Recurring chore cadence selector in UI** — The `cadence` field exists and the daily cron acts on it, but the web dashboard has no way to set it. One-off addition to the CreateChore form: a text field (or select: daily/weekly/monthly) that appears when `type = recurring`. ~1 hr.

## Phase 1 — Core Feature Set ✅ (completed 2026-06-10)

- **Chores**: ✅ one-off deadlines + escalating reminders, ✅ photo-required flag, ✅ race mechanic (first approval wins), ✅ kid-proposed chores
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

- **Recurring cadence UI** — `cadence` field exists and cron acts on it; web dashboard has no way to set it. ~1 hr. *(promoted to Recommended Next 3)*
- **Batch approval** — select multiple pending completions and approve/reject at once. High-value as chore count grows; server already handles individual approvals atomically. ~1-2 hrs.
- **Chore templates** — household-level library of reusable definitions. Creating a new chore picks from the library. ~2-3 hrs.
- **Parent earnings/activity report** — monthly summary (or exportable CSV): per-kid totals for chores completed, earned, spent, streak peak. ~2-3 hrs.
- **Notification quiet hours** — per-household window where ntfy sends are held/dropped (no 6am pings). ~1-2 hrs.
- **Kid avatar / display name color** — pick a color or emoji avatar shown on both apps. Low effort, high kid engagement. ~1-2 hrs.
- **Custom kid reminder times** — freeform time input in addition to the 1h/3h/tomorrow presets. ~1 hr.
- **Streak/expiry tuning UI** — milestone amounts hard-coded in `lib/streaks.js`; surface in household settings. ~1-2 hrs.
- **Multi-kid chore assignment** — currently one kid at a time; checkbox list would speed up race chore setup. ~1-2 hrs.
- **Per-kid goods rate** — `goods_rate` is household-wide; `users.goods_rate` with fallback to household rate would let kids at different ages have different conversion displays. ~1 hr.
