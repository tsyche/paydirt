# Pending feature acceptance

**TL;DR:** These features have implementation, but their completion evidence is incomplete or contradictory. Finish the specific checks below before moving them into the shipped index; Android typing and parent history are the current priorities.

**Status:** Building

**Fold into:** [FEATURES.md](../../FEATURES.md), [DEVICE_TESTING.md](../DEVICE_TESTING.md)

## Completion rule

The active [roadmap](../../ROADMAP.md) owns priorities. Passing API/unit tests
does not establish a mobile interaction that those tests do not exercise.
Record the relevant automated test and user-facing verification; retain an
explicit rollout check when deployment is not established. The original
records below preserve history, not completion claims.

## Current priority fixes

Android typing now keeps immediate field state and ignores stale portal echoes; regression checks exercise rapid middle edits, delayed echoes, template replacement, and clearing. Native IME/cursor proof is still required. Daily recurrence now counts an older assignment completed today, while approval of work completed yesterday does not consume today's occurrence. Feed Turtle's live configuration was not changed.

Web/mobile history and ledger entries show household-timezone timestamps. Pending approval and screen-time grant sections remain visible; past grants start collapsed above expanded recently approved chores. Verify native scrolling and empty states alongside the existing checks below.

Local verification on 2026-11-08: lint/typecheck, 480 workspace tests, all 79 API tests, and all 29 headless browser journeys passed (the starter-picker selector was corrected and rerun). Ledger verification matched every balance. These checks do not establish native IME behavior.

## Remaining acceptance

| Area | Evidence already present | Remaining work |
|---|---|---|
| Kudos | Schema, hook/client, parent controls, kid surfaces, unit/API checks | Verify parent award → kid notification/celebration/history and no replay on a second device. |
| Chore notes | Parent forms, template prefill, kid/approval rendering, server length cap | Verify actual create/edit/template and both kid layouts, including long text. |
| Partial credit | Shared/server payout logic, web/mobile controls | Verify parent percentage controls, confirmation, actual payout/history, zero-minute case, and undo restrictions. |
| Expanded My Bank | Separated sections in both kid homes; calculation/render tests and phone/tablet browser review | Verify native standard and simplified screens against real records, scrolling, and large text. |
| Personal archives | API tests cover owner privacy, settled-only eligibility, unchanged rewards/Kudos counts, retention, and guarded rollback; headless web Archive/Undo/Restore and catalogue-chore restore pass | Native left-to-archive, vertical scrolling, More actions → Archive, Undo/Restore, catalogue-chore restore, offline errors, tray cleanup, and cross-device refresh. Editable parent catalogue chores additionally use right-to-edit and retain visible Edit/Archive icons; verify pinned edit actions and cancellation. |
| Help cancellation | Shared control in both kid layouts; real API verifies both parent reminders clear and assignment status is unchanged | Native request → Cancel help request, failed request feedback, and parent refresh. |
| Parent history paging | Real API traversal tests cover 5/10 paging, ties, combined grant sources, and outstanding grants; browser paging passes | Verify native Show more, errors/retry, and realtime refresh retain expanded lists. |
| Approval feedback | Real API tests cover private delivery, validation, undo, and concurrent payout protection; browser cancel/save/error-draft checks | Verify native dialog, keyboard/large text, quick approval, and feedback discovery through both kid layouts. |
| Delivery windows | Multi-range/day overrides and backend checks; real API regression covers 5:30–9 AM plus 4:30–8:30 PM with a Wednesday exception on household and child settings | Verify saved weekday/weekend/day exceptions on both parent surfaces, reopening, queued release, and school-time/downtime interaction. |
| Banked window remainders | API boundary tests and isolated PocketBase/disk-worker tests cover split delivery, overnight carry, and replay protection | Deploy backend/worker together; verify a 30-minute reward at 8:15 PM delivers 15 before an 8:30 PM close, then 15 at the next opening. Repeat with active bonus. |
| Resolved action alerts | Real PocketBase tests cover exact-record cleanup for both parents, preserved pending alerts, and failed decisions | Updated APK: approve/reject, suggestion/spend decision, and broadcast reply clear linked in-app/tray alerts; preserve unrelated notifications and the service indicator. Legacy unlinked alerts require manual dismissal. |
| Timed chores | Server start/finish guard, persisted timer, both kid components, API regression | Verify start → background/restart → finish → approval and next-day reset on an actual native surface. |
| Direct parent bonus | Parent controls, queue, audit records | Verify the direct Bonus control and retry behavior; a chore-paid bonus does not prove this separate control. |
| Mobile chore creation/review | Rendered component tests, minimum validation, tab-ancestry regression | On updated APK: two-minute error; suggestion Approve opens review from Approvals; edit/save assigns and resolves once; Cancel stays pending. |
| Approval UI fixes | API regressions cover queue/limit behavior; form and CSS changes exist | Verify mobile decline reasons reach the kid, web assignment-limit hints, and partial-credit/approval inset layout on the actual surfaces. |
| Mobile starter picker | Shared age-band catalogue and mobile entry point exist | Verify native selection, duplicate skipping, and created chores; the older completed scope was web/CLI only. |
| OTA updates | Protocol/publisher helpers and tests | Verify JS-only update delivery and rollback on native app; APK self-update confirmation does not close OTA. |
| Mobile Activity report | Shared math/tests and screen component | Verify rendered report, kid/month selection, and deployment. |
| Web goals/co-parent controls | Recorded Playwright pass | Confirm the verified build is deployed; recheck the user-facing controls if the build has changed. |
| Overview dashboards | Shared math and recorded web test coverage; mobile entry point exists | Verify mobile Overview layout/period navigation; confirm rollout. |
| Foreground notification suppression | Kotlin counter/receiver code and JUnit coverage | Recheck foreground approval: UI updates without a duplicate system notification. |
| Realtime resume | Shared scheduler/unit/API reconnect tests | Recheck native foreground/offline recovery without manual refresh. |
| Expiry fix rollout | Fail-before/pass-after ledger replay tests; expiry was off in production | Confirm deployed backend contains replay fix before enabling expiry. No prior-loss repair is established as necessary while expiry remains off. |

Native deployment/observation requires a device or an available emulator.
Do not turn an unperformed check into a completion date. Existing dated
device observations in [DEVICE_TESTING.md](../DEVICE_TESTING.md) remain valid.

## Returned records

The following text was previously filed under shipped work. It is retained
verbatim except for links adjusted to this file's directory. A dated record
may describe an old implementation rather than the current implementation.

### 2026-11-02 — Expiry takes the right grit

Bug: `runDaily` summed stale `earn` rows and lapsed `min(sum, balance)`, so earn 100 (d1), spend 100 (d5), earn 50 (d20) lapsed the fresh 50 at d31. Fix: `expiryLapse` (`packages/shared/src/scheduling.ts`, hand-mirrored in `pb_hooks/lib/scheduler.js`) replays the kid's ledger oldest-first; each earn is a lot, debits consume the oldest lots, non-earn credits never expire. Seven unit tests cover it, including the spend-between-earns case. Not deployed yet; existing wrongly lapsed rows are not repaired. Known approximation: a reversal (parent un-approve) is a negative adjustment, so it consumes the oldest lot rather than the specific earn it undoes.

### 2026-11-02 — Overview dashboards (parent cost, weekly potential, kid My Bank)

- **Shared math** (`packages/shared/src/overview.ts`, unit-tested): `bankView`, `weeklyPotential`/`occurrencesPerWeek`, `periodRange`, `summarizePeriod`/`addSummaries`/`pctChange`. Client gained `listTransactionsInRange` and `listApprovedInRange`.
- **Parent** (web `OverviewView.tsx`, mobile `components/OverviewView.tsx`, atop the Ledger tab): week/month/year totals with previous-period navigation: earned, redeemed, parent adjustments, bonus minutes from time chores, chores done, per-kid split, `% vs last period`. Weekly potential per kid (recurring chores only, one-offs counted separately) with dollar and screen-minute equivalents. Parent-only; no sibling comparison on kid screens.
- **Kid**: `ClaimHero` and `SimpleKidHome` show 'could buy N min' (potential, floored to 5 min) beside the dollar value, recomputed from live rates.
- **Caveats:** dollars use today's `goods_rate`, so past periods shift if it changes (the page says so); potential is a ceiling since limits are advisory. Heatmap remains in the backlog.

### 2026-10-21 — App auto-updates (Tier 1 — expo-updates OTA)

- **App auto-updates (no Play Store)** — kids' devices currently only update by plugging in a cable. No Play Services means no Play Store auto-update, no Play Core in-app update API, no Firebase App Distribution. **Tier 1 — `expo-updates` OTA.** Covers JS/TS, components, business logic, styling. Does *not* require EAS; point `updates.url` at a self-hosted manifest (PocketBase can serve it). Silent, no user interaction. **Configure rollback as part of tier 1, not after.** A bad JS bundle remotely bricks the app on every kid's device simultaneously. **Tier 2 — version check + APK prompt** (native changes OTA structurally cannot deliver) remains unshipped. ~3-4 hrs per tier.

Shipped: `apps/mobile/app.config.js` layers `updates.url` (from `EXPO_PUBLIC_POCKETBASE_URL` + `/api/updates/manifest`) and `runtimeVersion.policy: "appVersion"` on top of `app.json`. `pocketbase/pb_hooks/updates.pb.js` implements the Expo Updates protocol: plain-JSON manifests for protocol 0/1, multipart `rollBackToEmbedded`/`noUpdateAvailable` directives on protocol v1, md5-keyed immutable asset serving, superuser-only `/api/updates/config` debug endpoint. Publish via `just update-publish` (`scripts/publish-update.mjs`: expo export → `pb_data/updates/<ver>/<epoch>/` with `manifest.json`, `metadata.json`, `expoConfig.json`, `assets/`); roll back via `just update-rollback` (`scripts/rollback-update.mjs` drops a `rollback` marker; protocol v1 clients fall back to the embedded bundle on next check; `clear=1` removes the marker). Pure helpers (`buildServerManifest`, `decideManifestResponse`, asset hashing, `sha256HexToUuid`) live in `packages/shared/src/updates.ts` — deliberately *not* re-exported from the shared index because they use `node:crypto`/`Buffer` and would break mobile/web typechecks; consumed by the publish script via `node --experimental-strip-types`. Regression tests: `updates.test.ts` (15 cases across hashing, manifest building, and the decision table). Tier 2 (version check + APK prompt) and final on-device validation (does an update actually land on GrapheneOS?) remain open — the latter is 🧑 needs-human.

### 2026-10-21 — Suppress foreground notifications

- **Suppress foreground notifications** — smoke-test finding (2026-10-21): approving while the kid app is foregrounded still posts a system notification; the checklist expects a silent in-app update when the app is open. Fix: `UnifiedPushReceiver.kt` checks foreground/process state (or an in-memory flag set by the JS side) before calling `notify()`. Native Kotlin — no repo test harness for it, so verification is a manual on-device check (or a later Robolectric investment). ~1 hr.

Shipped: pure-Kotlin `ForegroundCounter` (no Android imports) fed by `ActivityLifecycleCallbacks` on `MainApplication`; `UnifiedPushReceiver` skips `notify()` while any activity is started — live realtime updates already cover the screen. Phase 2's `spend_approved` broadcast still fires regardless. Regression tests: `ForegroundTrackerTest.kt` (4 JUnit cases incl. config-change activity overlap and negative-counter guard), run via `./gradlew :app:testDebugUnitTest` (not wired into `just test`/CI — gradle-only; on-device heads-up suppression still deserves a manual check next device session).

### 2026-10-21 — Realtime resubscribe on resume

- **Realtime resubscribe on resume** — smoke-test finding (2026-10-21): after a network interruption the realtime socket recovers eventually, but the UI can sit silently stale for tens of minutes. Fix: resubscribe on AppState `active` / reachability-restore (same trigger the offline banner already has), so `Users.subscribe` is re-established promptly. Acceptance: unit tests on the reconnect/resubscribe wrapper (clock-injectable, same style as the scheduling tests); integration or e2e check that a dropped-then-restored connection re-receives updates. ~2-3 hrs.

Shipped: `packages/shared/src/realtime.ts` (`resumeRealtime` forces an SDK socket rebuild that preserves subscription listeners; `createResumeScheduler` coalesces AppState-foreground and offline→online triggers). Mobile `useRealtimeResume` hook wired into KidHome, SimpleKidHome, ParentHome — rebuild + catch-up reload on every resume. Regression tests: `realtime.test.ts` (10 unit tests, fake timers) + integration test proving events re-flow after a silently-dropped socket (`hooks.integration.test.ts`).

### 2026-11-01 — Web kid-goal form and co-parent panel (parent parity)

- `GoalControl` (set/delete goal, confirm on delete) and `CoParentsPanel` (list/add) in `apps/web/app/components/Dashboard.tsx`, matching mobile. Two Playwright tests in `phase1.spec.ts`; `just test-all` passes. Not deployed.

### 2026-11-01 — Mobile parent Activity report (parent parity)

- `ActivityReport` on the mobile Kids tab mirrors the web report. `streakPeak` and `summarizeMonthActivity` moved to `packages/shared/src/activity.ts` (unit-tested) and are used by both. Closes the last gap from the parity pass. Not deployed; not viewed on emulator.

### Day-specific delivery schedules — 2026-11-04

Multiple comma-separated delivery ranges retain existing weekday/weekend settings. Optional `grant_day_windows` stores individual weekday exceptions on households and kids. Each day supports all day, specific hours, or no delivery. Kid day overrides take precedence over kid weekday/weekend defaults, then household day overrides and household defaults. Overnight ranges are supported; overlaps and incomplete lists are rejected. Web and mobile provide default-hour editors and day summaries, with collapsible household settings groups.

Migration `1717000039_delivery_days.js` adds the optional fields without rewriting existing settings. Removing it drops day exceptions; weekday/weekend defaults remain. Family Link schedule import and individual queued-grant holds remain separate follow-ups.

### Household calendar and daily recurrence — 2026-11-04

Daily repeat limits reset at household midnight rather than after 24 hours. Recurrence is transactional, retries every minute, and allows yesterday's pending approval alongside today's fresh occurrence. Timers start fresh on the new assignment. Weekly/monthly rolling windows remain unchanged.

The existing `grant_timezone` is now the household-wide IANA setting, defaulting to `America/Los_Angeles`. Cron schedules, recurring deadlines, quiet hours, reminders, digest days, streaks, report boundaries, date inputs, and history/ledger labels honor it. Stored timestamps and elapsed timers/expiry remain UTC instants. History distinguishes completion from approval dates. Changing the household setting updates the cron clock without a restart; stored assignment deadlines and published grant snapshots retain their original instant.

The sandbox `test-all` follow-up is documented in [AGENTS.md](../../AGENTS.md#development), including the optional webpack/polling fallback. The isolated runner supplies `PB_TEST_DB` for backdated fixtures; these tests never write the live database.

### Mobile chore reward feedback — 2026-11-04

The bonus-minutes input now states the five-minute minimum, five-minute steps, and 120-minute maximum. Invalid amounts flag the field and show a persistent inline explanation. Create-chore validation and API errors also appear beside the submit button rather than only in a four-second snackbar. Shared/server validation names the minimum explicitly. Rendered component tests cover two-minute rejection, seven-minute step feedback, guidance before entry, and a valid five-minute reward; these failed before the fix.

### Mobile suggested-chore review — 2026-11-04

The earlier prefill fix set the create-form flag without leaving Approvals, but the form lived inside the Chores tab and therefore remained hidden. The shared mobile create form now opens in a tab-independent modal, with editable suggestion details, persistent error feedback, and pinned Cancel / Create and approve controls. Old timer/deadline/reminder form state is reset before prefilling a suggestion. Cancelling leaves it pending; saving creates and assigns the chore before resolving the suggestion.

Rendered dialog tests cover visible fields, pinned actions, errors, and cancellation visibility. A JSX ancestry regression test rejects mounting the composer inside any tab condition; it fails when the original tab gate is restored. Native tap-through remains unverified.

### 2026-11-04 — Roadmap reconciliation: preserved implementation entries

Implementation is verified in source and commit history: Kudos (`5fa1b8d`, 2026-11-02); notes, recurring deadlines, partial credit, and My Bank (`f051d96`, 2026-11-02); timers and delivery controls (`b38efc3`, 2026-11-02). This archive preserves the original descriptions below, including superseded plans and stale status language; these records were returned from the shipped ledger because acceptance was incomplete. They are not completion claims.

### Kid "My Bank" dashboard — original entry

- **Kid "My Bank" dashboard** — expand the existing kid balance view with the deferred My Bank extras: pending bucks, goal progress, and streak. Kid-only mobile surface; no sibling data. The base money/minutes display is already shipped. ~2-4 hrs.

### Kudos: parent "you did good" bonus — original entry

- **Kudos: parent "you did good" bonus** (2026-11-02) — **Building.** Subjective bonus (default 100 grit, adjustable) with an optional reason, a push, a celebration on next open, a "Great work ×N" badge and a private history list. Own ledger type so Overview shows it separately. No minutes, no per-grade pay. [Plan](kudos.md). Parent action ships on web and mobile together.

### Chore notes / extra details — original entry

- **Chore notes / extra details** — optional free-form text on each chore for instructions or context ("rinse first, load top rack", "photo of the finished shelf"). `chores.description` (and the same field on `chore_templates`) already exists in the schema and types but no create/edit form sets it and no kid or approval view shows it, so this is mostly UI: add a multiline field to the web and mobile chore create/edit forms and template pre-fill, show it on the kid chore card (a short expandable line in simplified mode, not a wall of text) and in the approval queue row, and cap the length server-side. No migration expected. Open question: whether to snapshot the note onto the assignment so editing a chore later doesn't rewrite what an in-flight assignment showed. ~2-3 hrs. **Gotchas:** render as plain text only (no HTML or markdown) so a note can't inject markup; notes are visible to the kids, so keep parent-only comments out of this field (a separate parent-only note would be a different feature); templates copy the note at create time, so later template edits won't update existing chores; if the note is snapshotted onto the assignment, old assignments keep stale text; long notes will wreck the simplified-mode card layout, so truncate with expand.

### Recurring due days — original entry

- **Recurring due days** — a due day/time per cadence chore, e.g. weekly bins "done by Tuesday 8pm" for Wednesday pickup. Today `chores.due_at` is a single fixed timestamp (reminders escalate 24h → 2h → overdue in `scheduler.js`), so it can't repeat. Add a recurring due rule (weekday + time for weekly, time for daily, day-of-month for monthly) and have cron auto-assignment stamp each new assignment with its own computed deadline, so the existing escalation and overdue pings work per cycle. Show "due Tue" on the kid card and approval row. Open questions: whether an overdue chore stays open, expires, or pays reduced; and weekday handling across timezones (the household is single-timezone, so use its local time). ~3-5 hrs. **Gotchas:** weekday and time must use the household's local time, not UTC; `isQuietHours` already uses server-local time, so pick one convention and keep it everywhere, and watch the DST changeovers; cron auto-assignment only recreates a chore when no open one exists, so an overdue chore blocks the next cycle and the deadline never rolls; an assignment created after this cycle's due time must target the next occurrence, not an already-passed one; every overdue ping goes to parents, so a chronically late weekly chore will spam them each cycle unless the pings are capped; vacation mode must pause the deadlines too; keep the existing one-off `due_at` working alongside the new rule.

### Partial credit — original entry

- **Partial credit** — let a parent approve a bigger chore at a fraction of its reward when the kid did part of it, like folding half the socks before running out of steam. Today approval is all-or-nothing (approve pays the full reward, reject sends it back). Add an approve-partial action on the approval row (quick picks like 25/50/75% plus a custom amount) that pays the scaled bucks and minutes (minutes rounded to the 5-minute step), records the percentage on the assignment for the ledger and history, and notes it to the kid kindly ("Half done, paid half, nice effort"). Optionally a per-chore flag marks which chores allow partial credit so small ones stay all-or-nothing. A kid-side "I did part of it" marker is a later option. Open questions: whether the remainder stays open for finishing later, and how a partial counts toward streaks, badges and `max_per_period` (counts as done). Time grants are irreversible, so the confirm must show the scaled minutes. ~3-5 hrs. **Gotchas:** the ledger is append-only, so a partial approval must write one earn row at the scaled amount, never approve in full and then adjust down; undo must reverse that exact net; the pay math exists twice (`lib/chorePay.js` and `packages/shared/src/chorePay.ts`) and the scaling has to land in both with a parity test; minutes rounded to the 5-minute step can round a small partial to zero, so define the floor; kids may learn to stop early expecting half, so partial credit should stay a parent-only decision, with a kid marker later if ever; time grants are irreversible, so the confirm must show the scaled minutes; partial interacts with race (does the winner's partial still close the others?) and team chores (per-member percentages?).

### Time-grant windows (after-hours delivery) — original entry

- **Time-grant windows (after-hours delivery)** — kids can currently buy or earn screen time during school hours, so restrict when time is *delivered* to the device. Add household-configurable allowed windows (e.g. weekdays 3:30-8:00 PM, weekends all day) with optional per-kid overrides. Approval stays as is (bucks deducted, ledger row written); if the window is closed the grant stays Queued with "unlocks at 3:30 PM" shown to parent and kid. A pb_hooks cron (every ~5 min) drains Queued rows, oldest first, when a window is open, and touches the same trigger file `paydirt-fl.path` watches so there is one delivery path. Queued rows expire after N days; optional per-window cap; ntfy the kid when time lands. Window source is manual config first; Family Link's own school-time/bedtime schedules may appear in captured responses and could later seed defaults or warn on drift (unverified, undocumented API). Applies to both purchases and time-pay chores. ~4-6 hrs. **Gotchas:** first verify on a tablet whether bonus time added during Google school time or bedtime actually unlocks the device or just sits until the schedule ends; if it sits, the window check is partly cosmetic; evaluate windows in a stored household time zone, not the server's; check the window at delivery time, not approval time; bucks stay banked and never expire, only delivery is gated; the Queued state, cron and `paydirt-fl.*` units need integration tests with a faked clock; keep windows parent-only to edit.

### Timed chores — original entry

- **Timed chores** — optional `timer_minutes` on a chore, set when the chore is created or edited (web + mobile), for time-based tasks like reading 20 min, instrument practice, dribbling outside, or art projects. The kid taps Start and gets a countdown (a big ring in simplified mode); "I did it!" unlocks at zero. Store `timer_started_at` on the assignment rather than in the app, so backgrounding or restarting the app doesn't reset the countdown. Send a local notification at completion (no FCM needed). Pause/resume and a "time logged" line in the approval queue let parents sanity-check it; otherwise it runs on the honor system, since the tablet usually isn't with the kid while they dribble. Open questions: allow pauses or require continuous time, and whether partial time earns a partial reward. ~4-6 hrs.

### Open bugs reported 2026-11-04 — original entry

- **Open bugs reported 2026-11-04** — each needs a repro and a regression test with its fix:
  - ~~**Every decline needs a free-text reason sent back to the kid**~~ — **fixed 2026-11-04**. Added `decline_reason` to `chore_proposals` + `spend_requests` (migration `1717000038_decline_reasons`); proposal decline + spend deny now take (and forward) a reason on web + mobile, alongside the existing chore-reject reason.
  - ~~**Web: inner approval box is the same size as the outer box**~~ — **fixed 2026-11-04**: `.section-priority > .card` now has `margin-inline: 12px` so the tinted outer box is inset from the inner approval cards.

### Chore-list assign checkbox state after approval — original entry

- **Chore-list assign checkbox state after approval** — fixed 2026-11-04: when a kid's assignment is approved while they're at the chore limit, the assign checkbox now shows the informative hint (`✓ done · at limit (N per window)`) instead of falling back to a bare warning, so the row reads as completed rather than vanishing.

### Approval panel reflow on partial-credit expand — original entry

- **Approval panel reflow on partial-credit expand** — fixed 2026-11-04: the partial-credit `<details>` panel now overlays (`.partial-credit-panel`) instead of pushing the Approve/Reject row; inner approval cards are inset from the tinted outer box via `.section-priority > .card` margin.

### Previous recommended order

#### Recommended Next 3

1. **Kudos: parent "you did good" bonus** — **Building.** A parent chooses the kid, amount, and optional reason; the server creates an immutable award plus a non-expiring ledger credit, and the kid gets a push, one-time celebration, private history, and count badge. Web + mobile parent action ships together. [Plan](kudos.md). ~4-6 hrs.
2. **Chore notes / extra details** — implemented locally; validation deferred at owner's request. Web/mobile forms and templates, kid cards, and approval rows use the current chore note; server cap is 1,000 characters.
3. **Recurring due days** — implemented locally; validation deferred at owner's request. Daily/weekly/monthly rules use server-local time, snapshot the next deadline per new assignment, and retain existing escalation. Overdue chores stay open at full pay; rule edits affect future assignments.

### Then, in order

1. **Partial credit** — implemented locally; validation deferred at owner's request. Parent-only percentage approval on web/mobile; closes the chore, scales grit, rounds minutes down to five-minute steps, and rejects a zero payout.
2. **Kid "My Bank" dashboard** — implemented locally; validation deferred at owner's request. Both kid homes show available balance after pending spending, conversions, estimated pending earnings, savings goals, and streak.
3. **Time-grant windows (after-hours delivery)** — implemented locally; deployment/device validation pending. Household timezone, weekday/weekend defaults, per-day exceptions, multiple ranges, per-kid overrides, optional queue expiry to manual review, and worker checks before contacting Google. See [delivery schedule implementation](#day-specific-delivery-schedules--2026-11-04). Published jobs retain their window/expiry snapshot; settings changes apply when a job is next published. A grant already in flight may finish after closing time. **Remaining:** individual queued-grant “Hold until…” for one-off changes; verified Family Link schedule import with preview/apply; optional per-window caps.
4. **Timed chores** — implemented locally; validation deferred. Continuous server-stamped timer, duration fixed when assigned, restart-safe countdown, local completion notification, and completion guard on both kid homes. Parent web/mobile forms and template fields are included. No pauses; partial rewards remain a parent approval decision.

### Original Phase 2 status before reconciliation

### Phase 2 — Family Link Automation

**Status: API-first; spike proven 2026-10-25.** The accessibility-service path is shelved: on the Pixel 8, Family Link is installed in a separate GrapheneOS profile from PayDirt, and a service in one profile can't see another profile's apps. The live session also fixed two latent bugs in the service, so it is ready if ever revived: wrong parent package name (`familylinkparental` → `familylink`, now `FamilyLinkPackages`) and tapping with no pending grant (now `GrantArm`, 60 s window), plus a `PayDirtDump` view-tree logger for label tuning.

- **API grant spike** — shipped 2026-10-25 (see the [shipped ledger](../ledger/ROADMAP_SHIPPED.md)); type `10` replacement behavior and additive preservation verified 2026-10-28. Session lifetime remains open.
- **API grant in production** — shipped 2026-11-02 (see the [shipped ledger](../ledger/ROADMAP_SHIPPED.md)). Session lifetime is tracked by *Family Link session keep-alive* in the backlog.
- **Accessibility fallback (shelved)** — `FamilyLinkAccessibilityService.kt`; only revisit if the API path dies. Would require PayDirt + a push distributor in the same profile as Family Link.
- **Manual fallback** — retained regardless; users who don't have/need Family Link still get the approval flow.

- **Per-kid bonus screen time** — implemented locally on parent web/mobile Bonus controls: 5–120 minutes in five-minute steps, optional reason, explicit confirmation, audited standalone grant, retry deduplication, existing queue/windows/status/manual fallback. No grit changes; no deduction/undo. Awaiting validation and deployment.
- **Remaining daily Family Link time** — show each kid's current remaining daily screen time in the parent kid detail on web and mobile. First verify whether the existing authenticated Family Link API exposes a reliable remaining-time value and what it includes (base allowance, bonus time, device usage, school-time/bedtime restrictions, and multiple devices). Display the source's last-updated time and an unavailable/stale state; never infer remaining time from PayDirt grants alone. Keep Google session material on bb and return only the needed summary. API feasibility and comparison against a real tablet remain unverified; device confirmation needs a human.
  - Repository investigation: the only captured/read parser (`remainingBonusSeconds`) measures the active type-10 bonus using Google's server clock. It does not establish total daily remaining time. No total-time UI is added until authenticated read-only evidence can be compared with a real tablet; bb commands remain owner-run.

### Previous mixed resolved/open issue descriptions

The remaining work is rewritten as actionable items in ROADMAP.md; the original descriptions are preserved here.

- **Edit-panel UX is inconsistent (reported 2026-11-04)** — Save/Cancel sit at the bottom and panels shift as they open, so it is hard to tell what is being edited. Done: web kid settings uses the new `EditHeader` (title + Save/Cancel pinned at the top). Remaining web panels to convert: chore edit (`Dashboard.tsx` ~`cancelEdit`), the other Save/Cancel pairs in `Dashboard.tsx`, and `HouseholdSettings.tsx`; then the mobile edit forms (`ParentHome.tsx` chore edit, kid settings). Rule recorded in AGENTS.md.

- **PocketBase upstream has tags with no Release objects (found 2026-08-17)** — `just pb-download` now handles this: authenticated `releases/latest` lookup (gh/GITHUB_TOKEN) with a Homebrew fallback on macOS and actionable manual options elsewhere (fixed 2026-08-17, `a197def` + `8be6569`; docs updated). Remaining gap: non-macOS hosts during an upstream zero-Releases stretch still need a manual download — a tag-tarball/`go build` fallback is the possible follow-up.

- **Dependabot: dismissed, re-check for fixes (2026-10-31)** — `zod` 3.25.76 (#79; fix is 4.6.6+ only) and `deepmerge` 4.3.1 (#80; no patched release) are dismissed as tolerable risk: both arrive only through `@expo/cli` / `@expo/config`, build-time tooling that never ships in the APK. `node-forge` (#62) is fixed by a `pnpm.overrides` entry (1.4.2); its alert stayed open on a stale scan and was dismissed as inaccurate 2026-10-31. Re-check on each Expo SDK bump (and `pnpm outdated zod deepmerge`): drop the dismissals' reason if a patch lands, and remove the `node-forge` override once `@expo/cli` depends on a fixed version itself.

### Original contextual notes removed from active work

Added 2026-08-10. Items 1-4 (CI pipeline, ledger integrity verifier, cron/scheduled-job tests, offline/unreachable-backend UX), 6-7 (Android tests in CI, backups), and both tiers of auto-updates shipped; entries live in [docs/ledger/ROADMAP_SHIPPED.md](../ledger/ROADMAP_SHIPPED.md). Tier 2 self-update is confirmed on every tablet as of 2026-11-02. Native changes (new native deps, SDK bumps) still need a cable or the in-app prompt; Android forces a user tap on install.

Known gaps: none from the 2026-11-01 keyword-level pass (closed the same day; see the shipped ledger).

- **Overview reassessment (2026-11-02)** — the parent Overview modal shipped (cost strip, screen-vs-goods split, streaks). Skipped for now; reassess after a few weeks of real use: (a) dollar figure in the app header; (b) kid-facing lifetime totals ("grand total accomplished"); (c) actual-vs-potential trend across weeks; (d) heatmap (parked): kids see only their own, parents get a household grid. Open: reprice pending spend requests on approval (default no; prices lock at request time).

- **Expiry warnings for kids (2026-11-02)** — when `expiry_days` is on, ntfy the kid a week and a day before grit lapses ("40 Grit expires in 7 days; spend it or lose it"). Expiry is tracked per earn row by its `created` date, so each chore's grit has its own clock. The daily cron computes what will actually lapse in the next 7 days and 1 day, and dedupes (a warned-at marker per kid and window) so it never repeats. Expiry math fixed 2026-11-02 (`expiryLapse`); reuse it for the lot-remaining data: share one pure function in `packages/shared` for the cron, the warning and a "expiring soon" line in the kid bank card. Suppressed during vacation mode. Kudos grit is excluded.

- **Overview weekly potential looks high (2026-11-02)** — it is a perfect-compliance ceiling (every daily chore, every day, no missed days). The race double-count is fixed (the household total counts a race chore once). Still open: add a realistic figure next to it, such as the trailing 4-week actual average per week, once there are a few weeks of real data.

- **Kid ↔ parent messaging, next steps** (2026-11-01) — canned broadcast replies and the "I need help" flag are shipped. Still open: (a) a short free-text reply (~140 chars) with a rate limit and a mute option, only if canned replies prove too limiting; (b) formalize the kids' goal-text back channel as a "note to parents" field with an inbox badge.

- **Kid "ask for more time"** — per-chore pay mode shipped 2026-10-31 (see the shipped ledger). Still deferred: the kid ask button with a parent reply sheet that offers a bonus chore, suggested chores/minutes, parent-triggered nudges, and a daily bonus-minutes cap. Rejected for now: kid picks bucks or time, staleness premiums, automatic nudges. Full design: [docs/plans/bonus-minutes-and-time-asks.md](bonus-minutes-and-time-asks.md).
