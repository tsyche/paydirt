# Shipped Roadmap Items

**TL;DR:** Completed work with recorded implementation/verification evidence, followed by historical entries. Unfinished acceptance work is tracked in [ROADMAP.md](../../ROADMAP.md) and the [acceptance plan](../plans/feature-acceptance.md); old caveats are resolved only where later evidence is recorded.

## Shipped index

- [x] 2026-11-09 — Chore conversations, private decision history, and compact/expandable per-child time totals (local implementation; rollout/device acceptance remains in ROADMAP)

- [x] 2026-11-09 — Kid-controlled earned-time bank, 15-minute redemptions, and parent web/mobile totals (local implementation; deployment/device acceptance remains in ROADMAP)

- [x] 2026-11-08 — Owner confirmed Android typing fix and parent layout/archive/help walkthrough on the shipped app

- [x] 2026-11-08 — Owner confirmed the tablet/recurring batch shipped and pushed (`3d993c0`); native emulator evidence remains recorded under 2026-11-06

- [x] 2026-11-08 — Glob cancellation vulnerability patched to 14.0.2; synchronous/asynchronous traversal and abort smoke checks pass locally

- [x] 2026-11-06 — Tablet header actions and recurring due-day native acceptance passed on isolated API 34 emulator; deployment remains separate

- [x] 2026-11-06 — Recurring deadline arithmetic no longer inherits host DST gaps; fail-before/pass-after verified locally

- [x] 2026-11-06 — Web partial-credit control and resubmission context polished and browser-verified

- [x] 2026-11-06 — Multiple delivery windows persist; stale concurrent chore approvals cannot pay twice

- [x] 2026-11-06 — Tablet APK update handoff restored by correcting its saved APK handler

- [x] 2026-11-06 — `just ship` warns on uncommitted files and continues; build/deployment failures still stop it

- [x] 2026-11-06 — `just conn` skips unavailable devices successfully; mDNS endpoint parsing fixed

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


## Chore conversations and compact time totals (2026-11-09)

Implemented locally; backend/APK deployment and physical-device acceptance remain
in ROADMAP. Further server-free work remains deferred.

- Parent web/mobile and both kid layouts open a private occurrence-specific
  conversation. Send message is separate from Approve/Reject. Kids may submit a
  note with the existing camera/timer proof; messaging never changes payout,
  status, timer state, or the need for parent approval.
- Owner-approved defaults: text only, 1,000-character messages, no edit/delete,
  corrections via follow-up replies, history retained with the occurrence, and
  replies available before and after approval. Legacy feedback and decision
  events remain in context. Known old submission/approval dates are preserved;
  unknown authors and last-update dates are labelled honestly.
- Server-owned authors/audiences, transactional event ordering, unique retry
  keys, and persisted per-user drafts protect attribution and uncertain sends.
  Personal archives remain independent. Alerts open the exact thread; native
  push routing resolves an authorized inbox record. Web dialogs use native
  keyboard/focus handling and preserve drafts on Escape/reopen.
- Privacy regressions fail before/pass after: sibling reads of legacy feedback
  are blocked, and reassignment clears legacy copies while preserving the old
  kid's private timeline. A migration regression also proves Autodate no longer
  replaces known legacy timestamps. Populated histories block rollback/deletion.
- Main Kids cards show only banked available time. Mobile child detail and web
  child cards start with a collapsed bank section; expanded totals stack saved,
  reserved, requested, and queued minutes, followed by history. Both kid layouts
  retain their Use time flow. Native and browser layout tests detect the previous
  single wrapped line.
- Verification: 490 unit tests, 3 icon checks, 12 Android tests/compilation,
  102 shared API integrations, 10 native integrations, and 32 headless browser
  journeys. Changed bank/dialog flows receive focused browser rechecks. Browser
  verification isolates external Google font hosts; it does not prove font
  fidelity or physical-device keyboard/notification behavior. Lint/typecheck pass.

Original requested scope:

- **Conversation on a chore submission (requested 2026-11-09; requested)** — replace the decision-coupled “approve with comments” interaction with a private thread attached to the individual assignment/occurrence. Kids can include details or questions with their submission and reply later. Parents can ask a question or send a message without approving or rejecting; messaging alone never changes status, payout, or timer state. Keep quick approval available and preserve existing approval/rejection feedback in context.
  - **History and audience:** retain author, household-timezone timestamp, messages, and decision events in the item's history. Scope access to the assigned kid and authorized household parents; notification links reopen that item/thread. Personal archiving must not delete the conversation or hide it from the other participants. Specify edits/corrections, retention and attachment scope before implementation; a general family chat is outside this item.
  - **UX and acceptance:** provide distinct Send message, Approve and Reject actions on parent web/mobile, plus submission notes/replies in both kid layouts. Preserve drafts on failure; dedupe retry sends; notify participants without exposing sibling data. Test question → kid reply → later approval, messages on pending/returned/approved items, status/payout unchanged by messages, and complete thread recovery from history. Reuse existing note/feedback/notification seams where possible, but do not cram a multi-message thread into the one approval-comment field. Include encrypted thread access/retention in server-free parity.


## Earned-time bank and parent totals (2026-11-09)

Implemented locally; deployment and physical-device acceptance remain in ROADMAP.

- Kids choose Bank (default) or Use now at submission, including photo proof.
  Approval awards immutable held-minute earnings for time/both chores. Use now
  reserves whole 15-minute blocks; smaller remainders stay saved.
- Both kid layouts offer Use time in 15-minute steps, 15–120 per delivery under
  the existing worker limit. No second approval or extra Grit charge. Held time
  never expires or drains when a window opens; after-hours use requires explicit
  queue consent. Existing queued rewards and purchased time retain their state.
- Minute earns/reservations/releases and partial-delivery history are immutable.
  Transactions and unique keys prevent duplicate awards, overdrafts and retry
  grants. Mobile persists uncertain requests across restarts. Cancellation only
  releases queued time that has never been published; a permanent dispatch marker
  is committed before the worker sees a job. Manual and uncertain outcomes remain
  reserved for parent review. Time-paying approvals retain the existing undo prohibition.
- Parent web/mobile summaries and details separate saved available minutes,
  manual reservations, pending purchase requests, and queued remainders. Both kid
  layouts show their own totals/history. Sibling grant and purchase-request reads are blocked; regression tests reproduced
  both old exposures before the restrictions were applied.
- Streaks count held-minute earn dates and legacy chore rewards, excluding later
  redemptions and direct parent bonuses. A real API regression test reproduced
  bonus-driven streak inflation before the fix.
- Automated evidence: real-PocketBase accounting, concurrent approvals/debits,
  cancellation versus first publication, manual confirmation, lost-response/restart retries,
  rollback protection, legacy queue preservation, split delivery, and realtime
  parent/kid totals and foreground catch-up after missed realtime events.
- Verification: 488 workspace unit tests, 3 icon checks, 12 Android tests,
  93 shared API integrations, 5 native component integrations, and 30 headless
  Docker Playwright journeys. Lint and typecheck pass. An earlier development
  browser run timed out on Add chore stability; the frozen-source full run
  passed all 30 without retries. Physical-device acceptance remains pending.

Original requested scope:

- **Kid-controlled earned-time bank and parent totals (requested 2026-11-09; planned)** — let kids save chore-earned screen minutes instead of automatically activating/queuing them. Include chores paying time alone or time plus Grit. A kid can express Bank / Use now when submitting or collecting the reward; only parent approval actually awards minutes. Default selection and exact collection UI need design. Preserve the immutable earned-minute snapshot and avoid changing existing queued grants silently.
  - **Held is not queued:** saved minutes remain available until the kid explicitly redeems a chosen amount. A delivery window opening must not automatically drain the saved bank. Existing “banked” window remainders are queued automatic delivery, so distinguish that state and wording from the new held balance. Spending saved minutes must not charge Grit again. Decide parent re-approval requirements, allowed increments, cancellation, expiry, and how a request made outside allowed hours behaves; never silently convert Bank into “deliver next morning.”
  - **Parent visibility:** show each kid's saved available minutes in the Kids summary and kid detail on both web and mobile. Show reserved/requested minutes and minutes already queued for delivery separately; expose earned/redeemed adjustments in history. Both kid layouts show their own saved total and a simple Use time action. No sibling balance access.
  - **Accounting and acceptance:** immutable earn/reserve/redeem/release records, server validation and idempotency; concurrent redemptions cannot spend the same minutes twice. Test bedtime chores → next-morning window opens with saved balance unchanged → kid later uses only part of the balance → only that portion is delivered under current windows/restrictions. Cover offline retries, split delivery, cancellation, concurrent parent actions, rejected/undone chore approvals, and parent/kid realtime totals. This is separate from remaining daily Family Link time: it measures PayDirt-held minutes, not Google's remaining allowance. Include this lifecycle in the server-free parity model.


## Archived entries

### 2026-11-06 — Tablet header actions and recurring due-day acceptance

The shared header exposes tablet actions in the order balance, Alerts,
Overview, Theme, Settings, and Sign out. Native API 34 checks covered wide and
narrow tablet widths, large text, Theme/Settings navigation, and cancel/confirm
sign-out. Rendered classification tests cover phone overflow; the emulator
activity stayed portrait-locked during a landscape attempt.

Recurring daily acceptance used isolated fixtures in both standard and
simplified kid layouts. Yesterday's pending occurrence and today's actionable
occurrence displayed distinct dates. Timers survived app restart; approving
yesterday's standard-layout occurrence left today's assignment and timer
unchanged. Deadline-rule, snapshot, and browser acceptance evidence is recorded
in the [feature acceptance plan](../plans/feature-acceptance.md).

No production data was used and no deployment was performed. See
[API 34 emulator notes](../DEVICE_TESTING.md#api-34-emulator-acceptance-2026-11-06).

### 2026-11-06 — Host-independent recurring deadline arithmetic

A Tokyo household's 02:30 deadline moved to 03:30 when the host entered its own DST gap. Recurring calculation now carries household wall-clock fields through UTC Date arithmetic, then converts using the household timezone. Existing calendar consumers are unchanged. The regression failed before the fix; eleven direct deadline tests pass under both Pacific and UTC process timezones. Three live snapshot/tamper checks and nineteen existing recurrence/Phase 1 integration checks pass, with ledger verification clean. A headless template/prefill/create/edit/snapshot journey also passes. Both parent forms now label deadlines as household time, with fail-before/pass-after rendered checks. Backend deployment and the broader recurring native acceptance remain open in the [roadmap](../../ROADMAP.md#release-checks-for-implemented-work).

### 2026-11-06 — Web approval-card polish

Original scope: put Partial credit below Approve, with a recognizable percent control; preserve the overlay editor and stable primary actions. Replace the inline resubmission sentence with a badge, labelled previous parent feedback, and a separately labelled child reply.

Implemented with themed spacing, grouped controls, and escaped text. Render tests and a headless Playwright journey verify the labels, document-relative button placement before/after opening the editor, and an actual 50% approval. Browser tests also preserve normal approval/undo and irreversible time-grant behavior. Deployment is pending; the separate archive/help native acceptance is not claimed here.

### 2026-11-06 — Window storage and concurrent approval fixes

- Expanded the old 11-character weekday/weekend field limits on households and children without changing saved schedules. Rollback refuses while multiple ranges remain. Real PocketBase regression tests failed before the migration and pass with 5:30–9 AM plus 4:30–8:30 PM and a Wednesday-only exception.
- A stale concurrent approval could pay the same completed assignment twice. Status transitions now check the current record inside the write transaction. The concurrent-approval regression exposed the duplicate payout before the fix; approval, undo, feedback, and Family Link queue integration checks pass afterward.
- Backend deployment is pending. Native delivery settings acceptance remains in the [acceptance plan](../plans/feature-acceptance.md).

### 2026-11-06 — Tablet APK handler corrected

On `192.168.20.164`, Material Files was the saved APK handler and opened its
archive browser. Android's package installer was present, PayDirt's install
permission was allowed, and 11 GB was free. The parent cleared the association,
then selected the installer as the default and confirmed the update works.
No shared installer code change was needed. Material Files supports APK
installation from within the file manager; the external archive-view handler
was the problem here. The downloaded APK remains in PayDirt's private cache,
shared with the selected installer through FileProvider rather than Downloads.

### 2026-11-06 — Shipping with uncommitted work

`just ship` warns for modified or new files and continues with the working
tree, instead of requiring a commit. Help and deployment docs describe the
behavior and the unchanged commit-count APK version limitation. The actual
recipe is covered by shell tests for tracked/untracked files, clean trees,
and failed backend or APK stages, using fakes at the deployment boundary.

### 2026-11-06 — Nonfatal device connection checks

`just conn` now reports ready/unavailable counts and succeeds when every saved
device is offline or has debugging disabled. Missing configuration remains an
error, and install commands still check for a connected device. Fixed mDNS
parsing for `ip:port` endpoints, excluded pairing services, and removed the
duplicate fixed-port connection attempt.

Three shell regression tests failed before the fix and pass after it. Actual
`just conn` completed successfully with zero ready and four unavailable devices;
discovery recovery is covered at the ADB boundary, without claiming a physical
device connection.

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

### 2026-11-08 — Glob cancellation bypass

The former active issue (#81, reported 2026-11-04) resolved glob 13.0.6, which could continue traversing after an AbortSignal timeout. A scoped override now resolves affected transitive versions to 14.0.2. Node engine compatibility, CommonJS/ESM resolution, synchronous/asynchronous traversal, and immediate cancellation were checked locally. Deployment and GitHub alert closure follow the next approved push. [Advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4).

### 2026-11-08 — Tablet and recurring release confirmation

The owner reported shipping and pushing the tablet-header and recurring-deadline batch at `3d993c0`. API 34 emulator acceptance and automated coverage are preserved in the 2026-11-06 entry. This is owner-reported release confirmation; no additional physical-device checks were performed in this session.

### 2026-11-08 — Owner device walkthrough

The owner confirmed the installed Android app passes the supplied walkthrough: middle-of-field typing, backspace and keyboard suggestions, correct saved text, pending sections and empty messages, collapsed past grants above expanded history, household-timezone dates/times, catalogue edit/cancel/archive/restore, personal-history Undo/Restore, and help request/cancellation with parent refresh. The cursor bug no longer occurs. The owner also confirmed regular shipping. This report does not establish offline failures, cross-device behavior, large text, every kid layout, or external Google grant recovery.
