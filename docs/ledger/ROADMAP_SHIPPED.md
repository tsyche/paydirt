# Shipped Roadmap Items

**TL;DR:** Completed work with recorded implementation/verification evidence, followed by historical entries. Unfinished acceptance work is tracked in [ROADMAP.md](../../ROADMAP.md) and the [acceptance plan](../plans/feature-acceptance.md); old caveats are resolved only where later evidence is recorded.

## Shipped index

- [x] 2026-11-04 — Rapid-approval queue preservation and pending/approved/rejected limit counting verified against live PocketBase

- [x] 2026-11-04 — Family Link early-bonus allowance-loss report ruled out on device: normal daily time resumes after the bonus expires

- [x] 2026-11-02 — Tier 2 APK self-update confirmed on the remaining tablets
- [x] 2026-11-02 — Family Link automatic grants verified in production (real purchase and chore time grants land on the tablets)
- [x] 2026-11-02 — Mobile header menu (Theme / Alerts / Sign out, unread dot), grit dialog with dollars and screen minutes per kid and combined (web + mobile), `kids_see_balances` household setting
- [x] 2026-11-01 — Per-kid daily chore summary push; silent 3 AM recurring assignments
- [x] 2026-10-31 — Per-chore pay mode (bucks, screen time, or both)
- [x] 2026-10-31 — Advisory chore limits, streak bonuses, economy tuning
- [x] 2026-10-31 — One-command deploy (`just ship`) and in-app update fixes
- [x] 2026-10-23 — Go live on bb
- [x] 2026-10-29 — Age-grouped starter chores: shared catalogue, web picker, and CLI seeding (mobile acceptance tracked separately)
- [x] 2026-10-29 — Alert inbox (bell on mobile, Alerts tab on web), `needs_help` parent notification fix
- [x] 2026-10-29 — Host backups (nightly PocketBase zips + `backup-pull`), `push-updates`, `host-reset`/`go-live` onboarding
- [x] 2026-10-21 — Android unit tests wired into `just test` + CI (`test-android`, setup-java; confirmed 2026-10-29)
- [x] 2026-10-25 — Phase 2 spike: Family Link API grant
- [x] 2026-10-22 — App auto-updates (Tier 2 — version check + APK prompt)
- [x] 2026-10-22 — Feature explanation tooltips
- [x] 2026-10-22 — Approval queue photo grid
- [x] 2026-10-22 — Kid 'I need help' flag
- [x] 2026-10-22 — Kid weekly recap
- [x] 2026-10-22 — In-app ledger view
- [x] 2026-10-22 — Scheduled allowance (payday)
- [x] 2026-10-22 — Auto-save to savings goals
- [x] 2026-10-22 — Parent mobile parity (settings + ledger)
- [x] 2026-10-21 — Badge shelf, balance count-up, coin-pop celebrations, and calm-mode toggle (delivered subset)
- [x] 2026-10-21 — On-theme currency presets
- [x] 2026-10-21 — Verified Pixel 8 kid/photo/spend/push/connectivity checks (remaining journeys stay active)
- [x] 2026-10-21 — Phase 2 spend-approved notification trigger
- [x] 2026-08-17 — Notification deep links
- [x] 2026-08-17 — Offline / unreachable-backend UX
- [x] 2026-08-17 — Scheduled-job test coverage
- [x] 2026-08-12 — Ledger integrity verifier
- [x] 2026-08-12 — CI pipeline (GitHub Actions)
- [x] 2026-07-06 — Second parent support (co-parent)
- [x] 2026-06-28 — ntfy onboarding flow
- [x] 2026-06-10 — MVP, Phase 1, and Phase 1.5 (migrated 2026-10-21)

## Archived entries

### 2026-11-02 — Tier 2 APK self-update confirmed on the remaining tablets

Owner confirmed the remaining tablets self-updated after the 2026-11-02 ship. This closes the device-validation follow-up for Tier 2 (version check, APK download, and Android installer prompt); native changes still require the normal one-tap Android install confirmation.

### 2026-11-02 — Family Link automatic grants verified in production

Owner confirmed the remaining checks on 2026-11-02: grants work end to end on the tablets. Built and proven earlier: pricing and per-kid IDs, host tooling, session moves between machines, additive grants (59 + 60 = 119 s), approval queue and worker with `FL_AUTOMATION_ENABLED=1`, session verified 2026-10-31, per-chore pay mode, and the daily chore summary push. Still open and tracked in the backlog: how long the copied Google session lives with occasional use (*Family Link session keep-alive*).
### 2026-10-25 — Phase 2 spike: Family Link API grant

- `just fl-login` / `just fl-grant <seconds>` → `scripts/familylink-grant.mjs`; pure helpers + unit tests in `packages/shared/src/familylink.ts`. A 300 s grant was confirmed on child2's tablet.
- Grant = one `POST` to `kidsmanagement-pa.clients6.google.com/.../people/{childId}/timeLimitOverrides:batchCreate`, sent in-page from familylink.google.com. Headers go in `$httpHeaders`; Authorization is `SAPISIDHASH` only. The web app's three `x-goog-ext-*-bin` headers aren't required.
- Sign-in: Google rejects every automated browser ("not secure"), including Playwright Firefox, Playwright-launched Chrome, and real Chrome with a CDP port open. What works: plain Chrome on a dedicated profile with nothing attached, signed in by hand, then reopened headless to export `storageState` (chmod 600, `~/.config/paydirt/`).
- Account: shared co-parent account in Family Link's second (and last) parent slot; both parents use it for manual grants.

### 2026-10-22 — App auto-updates (Tier 2 — version check + APK prompt)

**Later evidence:** the owner confirmed self-update on the remaining tablets on 2026-11-02 (record above). The original on-device gate below is closed, not an outstanding task.

- **Tier 2 (native APK)** — agent-doable pieces shipped: `GET /api/updates/version` + `GET /api/updates/apk` (PocketBase, `lib/updates.js`), mobile polling (`apps/mobile/lib/appUpdate.ts`), DownloadManager install intent (`PayDirtNative.downloadAndInstallApk` + `REQUEST_INSTALL_PACKAGES`), `just publish-apk`. Tier 1 hook refactored into `lib/updates.js` (top-level bindings invisible inside routerAdd handlers in this Goja runtime) and root corrected to `$app.dataDir()/updates`. On-device validation (install prompt lands + APK installs on GrapheneOS) remains human-gated.

### 2026-06-10 — MVP, Phase 1, and Phase 1.5 (migrated from active roadmap 2026-10-21)

**MVP — Shipped**

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

**Phase 1 — Core Feature Set ✅ (completed 2026-06-10)**

- **Chores**: ✅ one-off deadlines + escalating reminders, ✅ photo-required flag, ✅ race mechanic (first approval wins), ✅ kid-proposed chores, ✅ recurring cadence selector in web UI
- **Currency**: ✅ configurable currency name, ✅ bank thresholds, ✅ spontaneous bonus/deduction, ✅ optional expiry (off by default), ✅ physical goods exchange rate (conversion display)
- **Savings goals**: ✅ named goals with progress bars, multiple goals, fulfilled notifications
- **Kid UX**: ✅ glanceable home screen (balance + to-do count + streak + due chips), ✅ chore history (collapsible, capped), ✅ simplified mode, ✅ kid-added reminders
- **Parent UX**: ✅ scheduled chore reminders, ✅ approval nudges, ✅ approval undo, ✅ household broadcast, ✅ approval reactions

**Phase 1.5 — Gamification & Reporting ✅ (completed 2026-06-10)**

- ✅ Streak bonuses (3/7/14/30-day milestones, 🔥 shown in both apps)
- ✅ Weekly digest (Sunday 6pm ntfy summary to parents)
- ✅ Pause/vacation mode (suspends reminders, nudges, digest, expiry)
- ✅ Chore swap between siblings (offer → accept/decline, server-guarded)
### 2026-10-21 — Deeper gamification ("playful" mode)

- **Deeper gamification (full "playful" mode)** — the design refresh landed a playful-but-grown-up baseline (tactile buttons, claim hero, coin-pop on approval). Architecture (`Celebration`, `ChunkyButton`, palette packs) is built to dial *up* toward a fuller Duolingo-style experience. Candidate additions: a household mascot, richer celebration sequences (XP-style count-up on the claim hero), badge/achievement shelf, streak-freeze mechanic, sound effects (opt-in), and an optional per-kid "max playful" intensity. Keep parent surfaces calm (the Slate pack); scope playful escalation to the kid views. Gate behind a setting so parents control the dial. ~1-2 days.

Shipped: badge shelf (pure `computeBadges` in `packages/shared/src/badges.ts` — first chore, 10/50 chores, 3/7/30-day streaks, first/3 goals, 100/500 bank; `BadgeShelf.tsx` shows earned + next-locked with progress), XP-style count-up on ClaimHero and the SimpleKidHome balance (`useCountUp`, reduce-motion aware), and coin-pop celebration when a kid's balance ticks up (`shouldCelebrate` gates increase-only). All three silenced by a new per-kid `users.calm_mode` bool (migration `1717000015`), toggled from mobile KidDetail and the web avatar editor. Parent surfaces unchanged. Regression tests: `badges.test.ts` (7 cases across computeBadges/earnedBadges/shouldCelebrate); not-yet-shipped candidates (mascot, sounds, streak-freeze) stay out of scope.

### 2026-10-21 — On-theme currency presets

- **On-theme currency presets** — `currency_name` is already per-household configurable; consider shipping themed default suggestions (e.g. Nuggets, Gold, **Grit (top pick)**, Karats) and a richer default than "parentBucks" to match the Goldrush identity. ~1 hr.

Shipped: `packages/shared/src/currency.ts` (`DEFAULT_CURRENCY_NAME = "Grit"`, `CURRENCY_PRESETS`, `currencyDisplayName`), presets row with `aria-pressed` state in `HouseholdSettings.tsx`, all consumers (mobile KidHome/SimpleKidHome/ParentHome/KidDetail, web Dashboard, Goja hooks) switched to the shared fallback. Regression tests in `packages/shared/src/currency.test.ts`; surface Playwright-verified 2026-10-21.

### 2026-10-21 — Real-device smoke test (Pixel 8 / GrapheneOS)

1. **Real-device smoke test** — emulator works; GrapheneOS/LineageOS hasn't been validated. Prerequisite for Phase 2. Run the full flow (login → chore → complete → approve → spend) on a physical device over wireless adb. ~2 hrs.
   - 🧑 needs-human: physical GrapheneOS/LineageOS device + manual observation

Completed 2026-10-21 (Pixel 8 / GrapheneOS). Server-side flow exercised end to end (chore → assign → complete → approve → spend; balances and ledger exact — `just verify-ledger` clean). All four notification types confirmed on-device from PayDirt's own channel. Notification-tap routing verified warm and cold. Auth persists across force-stop/relaunch; crediting works while the app is dead. Offline banner appears on PB stop (data retained) and auto-clears on restart. Kid spend dialog submits; parent approval deducts exactly and notifies. Recurring "Chore time!" reminders fire in production. Simplified mode verified live on child2. Noted findings (foregrounded approve → duplicate notification; force-stopped app drops UP messages until relaunch; realtime staleness during network interruptions) became roadmap backlog items; full detail in `docs/DEVICE_TESTING.md`. Open on-device checks: parent login surface, UI-tapped non-photo "I did it!".

### 2026-10-21 — Phase 2 spend-approved notification trigger

1. ✅ **Wire the Phase 2 notification trigger** — shipped 2026-10-21; chain verified on the Pixel 8.

`UnifiedPushReceiver.kt` sends the local `ACTION_GRANT_SCREEN_TIME` broadcast on `type == "spend_approved"` (alongside the existing deep-link handling). Verified on-device via logcat: the spend payload fires the broadcast, no-type/other-type payloads don't; `FamilyLinkAccessibilityService` receives and launches Family Link in ~10 ms (no-op when Family Link is absent). Live Family Link validation remains a separate human-gated item.

### 2026-08-17 — Notification deep links

1. ✅ **Notification deep links (2026-08-17)** — `UnifiedPushReceiver.kt` attaches a `PendingIntent` carrying the payload's `type` as a `paydirt://` deep link; `App.tsx` wires `Linking` (cold + warm start) to route to the relevant screen. JS routing logic is unit-tested; native tap-through is **not yet confirmed on a device**. See *Phase 2* for a related, still-open gap this work does **not** close.

Native tap-through later confirmed on the Pixel 8, 2026-10-21 (warm: lands KidHome with correct balance; cold: process-confirmed after `am kill`).

### 2026-08-17 — Offline / unreachable-backend UX

2. ✅ **Offline/unreachable-backend UX (2026-08-17)** — mobile app detects an unreachable PocketBase (`apps/mobile/lib/reachability.ts`), shows a banner with manual retry, retries automatically on reconnect, and keeps last-known data visible instead of blanking. See *Quality & Infrastructure* #4.

### 2026-08-17 — Scheduled-job test coverage

3. ✅ **Scheduled-job test coverage (2026-08-17)** — fire/no-fire decision logic for reminders, deadline escalation, currency expiry, weekly digest, and streak milestones extracted into `packages/shared` as pure, clock-injectable functions, with vacation-mode-gated unit tests. `pb_hooks` mirrors the same logic by hand (Goja has no TS/ESM support). See *Quality & Infrastructure* #3.

### 2026-08-12 — Ledger integrity verifier

4. ✅ **Ledger integrity verifier (2026-08-12)** — `just verify-ledger` recomputes balances from `currency_transactions` and diffs against the cache; wired into `just test-all`/CI. See *Quality & Infrastructure* #2.

### 2026-08-12 — CI pipeline (GitHub Actions)

5. ✅ **CI pipeline (2026-08-12)** — `.github/workflows/ci.yml`: `checks` job runs `just lint`, `just typecheck`, `just test` on every push and PR; `integration-e2e` job (`workflow_dispatch`) runs `just test-all` against a self-contained ephemeral PocketBase. See *Quality & Infrastructure* #1.

### 2026-07-06 — Second parent support (co-parent)

- ✅ **Second parent support** — migration adds create rule so any parent can add a co-parent in Settings; seed includes `parent1@test.local` + `parent2@test.local`; `notifyParents` already fans out to all parents.

### 2026-06-28 — ntfy onboarding flow

- ✅ **ntfy onboarding flow** — shipped 2026-06-28; `NtfySetup` modal + `lib/ntfy-onboarding.ts`.

### 2026-06-10 — 2026-07-06 — Earlier completions

- Toolchain upgrade (2026-07-06) — TypeScript 6, vitest 4, Expo SDK 57, Next.js 16. React stays pinned at 19.2.3 via `pnpm.overrides`.
- Co-parent support (2026-07-06) — migration adds a create rule so any parent can add a co-parent in Settings; seed ships `parent1@test.local` + `parent2@test.local`; `notifyParents` already fanned out to all parents.
- Node 26.4.0 upgrade (2026-07-06) — `.tool-versions` bump, minor dep bumps, doc staleness pass. Note: Node 26+ no longer bundles corepack.
- Accessibility service in-app prompt (2026-07-06) — Settings tab in `ParentHome` detects whether `FamilyLinkAccessibilityService` is enabled via flag file (`lib/accessibility-service.ts`); shows amber banner with "Open Accessibility Settings" deep-link when off, green status card when active. `backgroundService.ts` dead import cleaned up; mobile vitest wired up.
- ntfy onboarding flow (2026-06-28) — detects if the ntfy app is installed on first launch; if not, prompts "Install ntfy" (opens Play Store); once installed, a config wizard lets the parent choose public ntfy.sh vs. self-hosted, persisted via AsyncStorage. `NtfySetup` component + `lib/ntfy-onboarding.ts`.
- Design system overhaul (2026-06-17) — Fredoka display face, `ChunkyButton`, claim balance hero, coin-pop `Celebration`, tabbed IA, 5 palette packs + System/Light/Dark, `KidDetail` drill-in, CSS-sync test
- Phase 2 scaffolding (2026-06-16) — `FamilyLinkAccessibilityService.kt` view-tree walker + broadcast receiver, registered in AndroidManifest; UP payload `type` field; spend-approval hook fires `spend_approved`
- Currency ledger CSV export (2026-06-16) — `buildLedgerCsv` + 7 unit tests
- Mobile chore template parity (2026-06-16) — collapsible template picker + "Save as template"
- Chore edit on mobile, due date on create-chore form
- Per-kid goods rate, web chore edit, custom kid reminder times, parent mobile chore creation + sibling leaderboard
- `withUnifiedPush.js` lint fixes, multi-kid chore assignment, parent earnings/activity report, streak/expiry tuning UI
- Notification quiet hours, chore templates, parent mobile view (approvals/spend/broadcast)
- MD3 design overhaul (web + mobile), kid avatar + color
- Phase 1 + 1.5 features: races, savings goals, streaks, chore swap, weekly digest, vacation mode

### 2026-10-22 — Feature explanation tooltips

- **Feature explanation tooltips** — shipped 2026-10-22: shared `FEATURE_TIPS` map in `packages/shared/src/featureTips.ts`; web hover ⓘ on HouseholdSettings fields; mobile ⓘ + dialog for Calm mode in KidDetail.

### 2026-10-22 — Parent mobile parity (settings + ledger)

- **Parent mobile parity** — shipped 2026-10-22: household settings screen + ledger tab added to mobile ParentHome (recent activity still web-only).

### 2026-10-22 — Approval queue photo grid

- **Approval queue photo grid** — shipped 2026-10-22: inline thumbnails (web + mobile) with tap-to-enlarge lightbox so parents verify photos without opening each request.

### 2026-10-22 — In-app ledger view

- **In-app ledger view** — shipped 2026-10-22: web '📒 Ledger' tab with per-kid + month filter and net total.

### 2026-10-22 — Kid 'I need help' flag

- **Kid "I need help" flag** — shipped 2026-10-22: `needs_help` field on assignments, kid tap (KidHome + SimpleKidHome) notifies parents via ntfy, cleared on mark-done/approve; shown in approval queues (web + mobile).

### 2026-10-22 — Auto-save to savings goals

- **Auto-save to savings goals** — shipped 2026-10-22: `auto_save_percent` on savings_goals, mobile goal form input, notification on earn with the slice; migration 1717000018.

### 2026-10-22 — Kid weekly recap

- **Kid weekly recap** — shipped 2026-10-22: `runKidWeeklyRecap` sends each kid a Sunday ntfy with earnings, chores completed, and nearest goal progress; vacation-mode gated; manual trigger `kid-recap`.

### 2026-10-22 — Scheduled allowance (payday)

- **Scheduled allowance ("payday")** — shipped 2026-10-22: household allowance_amount/cadence + daily cron grant (manual trigger `allowance`), notifies kids.

### 2026-10-31 — Per-chore pay mode (bucks, screen time, or both)

**Later evidence:** production time-pay grants were owner-confirmed on 2026-11-02; the owner also verified a five-minute time-pay chore on 2026-11-04. The earlier first-time-chore gate below is closed.

- `chores.pay_mode` per chore, paid via `time_grants` and the Family Link queue; pay math in `pocketbase/pb_hooks/lib/chorePay.js` and `packages/shared/src/chorePay.ts` (d621c20). Deployed to bb 2026-10-31. Tablet APK check and the first real time chore are still open (see Recommended Next 3). The kid "ask for more time" button and other follow-ups remain in the active backlog.

### 2026-10-31 — Advisory chore limits, streak bonuses, economy tuning

- Per-chore repeat limits with assign warning (7add3ea); `screen_rate` 3, `goods_rate` 88, streak bonuses 3/7/14/30 days = 40/100/250/600 set on bb. Limits are advisory and client-side only.

### 2026-10-31 — One-command deploy (`just ship`) and in-app update fixes

**Later evidence:** all remaining tablets self-updated on 2026-11-02 (record above), closing the earlier tablet-install follow-up.

- `just ship` deploys the backend, builds and publishes the APK, and adb-installs where reachable (793886d); native download method and install permission fixed (570559a). Self-update validated end to end on one phone; other tablets still need one adb install of the new build.

### 2026-10-23 — Go live on bb

- PayDirt production runs on bb:3111 since 2026-10-23 (`update-service`, nightly backups, `go-live`, `push-updates`; see [deployment](../DEPLOYMENT.md#going-live-with-a-real-household)). Date taken from project memory, not a commit.

### 2026-11-01 — Per-kid daily chore summary push; silent 3 AM recurring assignments

- `users.digest_weekday` / `digest_weekend` (HH:MM, server-local) with a `digest_sent` marker, sent by the 10-minute scheduler tick (`pocketbase/pb_hooks/lib/scheduler.js`); migration `1717000026` adds `assignments.auto_created` so the 3 AM auto-assignment no longer pushes 'New chore!'. Deployed to bb 2026-11-01 (`e33fdfc`); times set in the app, summary push confirmed arriving. A grit + time chore approved the same day paid out through the Family Link queue (time grant lagged the grit).

### 2026-11-04 — Approval queue and repeat-limit regressions verified

Real PocketBase integration tests verify the application-owned queue and limit states; this does not claim an unperformed native UI test. Original resolved reports:

  - ~~**Rapid approvals may lose queued screen time (verify)**~~ — **verified 2026-11-04** (no bug): new integration test queues/approves three back-to-back time-pay chore approvals and asserts each gets its own grant, none dropped.
  - ~~**Chore count limits not honored after submit**~~ — **verified 2026-11-04** (no bug): new integration test covers pending/approved/rejected counting; cron does not re-create within the window and advisory warnings count all three states.

### 2026-11-04 — Ordinary Family Link time resumes after bonus expiry

Owner approved a five-minute time-pay chore with two hours of ordinary daily time remaining. After the bonus expired, ordinary daily depletion resumed. The reported allowance-loss bug was ruled out on the device; no grant-calculation change was required.
