# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

## Recently Completed


1. ✅ **Native push notifications (2026-06-11)** — EAS/standalone APK build pipeline (`just prebuild` + `just build-apk` + `just install-apk`); foreground service polls PocketBase every 30s when backgrounded; notifications appear from PayDirt (not ntfy); ntfy removed from kid-facing hooks, kept for parent web alerts. UnifiedPush (zero-Google, no persistent indicator) is the planned fast follow.
2. ✅ **One-command live test run (2026-06-10)** — `just test-all` boots ephemeral PocketBase on :8091, migrates, seeds, runs integration + e2e, tears down. No manual server setup required.
2. ✅ **Kid broadcast history (2026-06-10)** — `getRecentBroadcasts()` added to shared client; KidHome shows last 5 broadcasts in a "From parent 📣" section; SimpleKidHome shows last 3 as big cards.
3. ✅ **Parent dashboard realtime (2026-06-10)** — `subscribeToDashboardUpdates()` added to shared client; Dashboard wires it up in `useEffect` so approvals, spend requests, proposals, chore changes, and kid balances update live without post-action full reloads.
4. ✅ **Recurring chore auto-assignment (2026-06-10)** — `runDaily` now re-creates assignments for recurring chores (daily or weekly cadence) when no open assignment exists for a kid who's had the chore before. Duplicate-safe: a second cron pass is a no-op if one is already assigned. Integration test added.
5. ✅ **Phase 1 + 1.5 wrap (2026-06-10)** — deadlines with escalating reminders, race mechanic, kid-proposed chores, savings goals, bank threshold, currency expiry, goods-rate display, kid reminders, scheduled chore reminders, approval nudges, approval reactions, streak bonuses, weekly digest, chore swap, vacation mode, household settings panel. Cron foundation (`scheduler.pb.js`, 10-min tick + daily + weekly) with superuser-only manual triggers for tests.
6. ✅ **Rejected-chore flow** — kids reply to rejections or resubmit; resubmission requires a fresh photo (server-enforced); parents see replies in the approval queue; simplified mode "Try again 📷".
7. ✅ **Real-time updates / test suite / broadcast** — kid screens subscribe live; 18 integration + 4 Playwright tests; household broadcast.

## Recommended Next 3

1. **Dark mode support (mobile)** — real-device testing confirmed dark mode breaks the UI; hardcoded colors and `opacity`-based text throughout the mobile screens need to be replaced with `useTheme()` / `theme.colors.*` from react-native-paper. High priority before kids use it daily. ~2-3 hrs.
2. **Mobile UI design polish** — full visual pass on all kid-facing screens (KidHome, SimpleKidHome, Login, ParentNotice); fix layout gaps, button feedback, error states, and "try again" flows. Use `frontend-design@claude-plugins-official` skill. ~3-5 hrs.
3. **UnifiedPush fast follow** — ~50 lines of native Android Java + a JS bridge; ntfy becomes invisible plumbing and the persistent service indicator goes away. Fully Google-free. ~1 day.

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

- **"Try again" button audit** — real-device testing showed some "try again" buttons are no-ops; trace each one to confirm error handling surfaces properly and retries actually re-invoke the underlying action. ~1 hr.
- **ClientResponse error display** — PocketBase errors surface as raw `ClientResponse0` strings in some flows (e.g. photo resubmission); map common error codes to human-readable messages. ~1 hr.

- **Batch approval** — select multiple pending completions from the dashboard and approve/reject them all at once. High-value UX as chore count grows; the server already handles individual approvals atomically. ~1-2 hrs.
- **Chore templates** — a household-level library of reusable chore definitions (name, description, reward, photo_required). Creating a new chore picks from the library instead of typing from scratch. ~2-3 hrs.
- **Parent earnings/activity report** — monthly summary page (or exportable CSV) showing per-kid totals: chores completed, earned, spent, streak peak. Complements the weekly digest with a longer view. ~2-3 hrs.
- **Notification quiet hours** — per-household window where ntfy sends are held or dropped (no 6am "chore approved" dings). ~1-2 hrs.
- **Kid avatar / display name color** — simple personalization (pick a color or emoji avatar) shown on both apps next to the kid's name. Low effort, meaningfully boosts kid engagement. ~1-2 hrs.
- **Recurring chore cadence selector in UI** — `cadence` field exists and the cron acts on it, but the web dashboard has no UI to set it. ~1 hr.
- **Custom kid reminder times** — the preset 1h/3h/tomorrow picker could take a freeform time. ~1 hr.
- **Streak/expiry tuning UI** — milestone amounts are hard-coded in `lib/streaks.js`; surface them in household settings if the defaults chafe. ~1-2 hrs.
- **Multi-kid chore assignment in dashboard** — currently parents assign one kid at a time; a checkbox list would speed up setup for race chores or shared tasks. ~1-2 hrs.
- **UnifiedPush** — fast follow to the shipped foreground-service notifications. Small native Android shim replaces the persistent service indicator; ntfy becomes invisible plumbing. FCM can be wired as a fallback path for any future public release. ~1 day.
