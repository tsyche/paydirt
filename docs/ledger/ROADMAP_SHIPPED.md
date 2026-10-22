# Shipped Roadmap Items

**TL;DR:** Compact index of completed roadmap work followed by the original entries.

## Shipped index

- [x] 2026-10-21 — Suppress foreground notifications
- [x] 2026-10-21 — Realtime resubscribe on resume
- [x] 2026-10-21 — On-theme currency presets
- [x] 2026-10-21 — Real-device smoke test (Pixel 8 / GrapheneOS)
- [x] 2026-10-21 — Phase 2 spend-approved notification trigger
- [x] 2026-08-17 — Notification deep links
- [x] 2026-08-17 — Offline / unreachable-backend UX
- [x] 2026-08-17 — Scheduled-job test coverage
- [x] 2026-08-12 — Ledger integrity verifier
- [x] 2026-08-12 — CI pipeline (GitHub Actions)
- [x] 2026-07-06 — Second parent support (co-parent)
- [x] 2026-06-28 — ntfy onboarding flow

## Archived entries

### 2026-10-21 — Suppress foreground notifications

- **Suppress foreground notifications** — smoke-test finding (2026-10-21): approving while the kid app is foregrounded still posts a system notification; the checklist expects a silent in-app update when the app is open. Fix: `UnifiedPushReceiver.kt` checks foreground/process state (or an in-memory flag set by the JS side) before calling `notify()`. Native Kotlin — no repo test harness for it, so verification is a manual on-device check (or a later Robolectric investment). ~1 hr.

Shipped: pure-Kotlin `ForegroundCounter` (no Android imports) fed by `ActivityLifecycleCallbacks` on `MainApplication`; `UnifiedPushReceiver` skips `notify()` while any activity is started — live realtime updates already cover the screen. Phase 2's `spend_approved` broadcast still fires regardless. Regression tests: `ForegroundTrackerTest.kt` (4 JUnit cases incl. config-change activity overlap and negative-counter guard), run via `./gradlew :app:testDebugUnitTest` (not wired into `just test`/CI — gradle-only; on-device heads-up suppression still deserves a manual check next device session).

### 2026-10-21 — Realtime resubscribe on resume

- **Realtime resubscribe on resume** — smoke-test finding (2026-10-21): after a network interruption the realtime socket recovers eventually, but the UI can sit silently stale for tens of minutes. Fix: resubscribe on AppState `active` / reachability-restore (same trigger the offline banner already has), so `Users.subscribe` is re-established promptly. Acceptance: unit tests on the reconnect/resubscribe wrapper (clock-injectable, same style as the scheduling tests); integration or e2e check that a dropped-then-restored connection re-receives updates. ~2-3 hrs.

Shipped: `packages/shared/src/realtime.ts` (`resumeRealtime` forces an SDK socket rebuild that preserves subscription listeners; `createResumeScheduler` coalesces AppState-foreground and offline→online triggers). Mobile `useRealtimeResume` hook wired into KidHome, SimpleKidHome, ParentHome — rebuild + catch-up reload on every resume. Regression tests: `realtime.test.ts` (10 unit tests, fake timers) + integration test proving events re-flow after a silently-dropped socket (`hooks.integration.test.ts`).

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
