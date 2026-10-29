# Roadmap

## TL;DR

MVP, Phase 1, and Phase 1.5 are shipped. Additive Family Link grants are verified on bb; the approval queue is implemented locally and awaits deployment. Other priorities are off-LAN access and validating APK updates on real devices.

Scope checklist: [FEATURES.md](./FEATURES.md). **This file is the authoritative
status tracker.**

Original design scratchpad (rationale + alternatives considered, not status):
`~/.claude/plans/archive/paydirt-plan.md` — archived 2026-08-10, formerly
`~/.windsurf/plans/choregalore-plan.md`.

**Doability tags:** items an agent can't start on its own are marked
`🧑 needs-human:` with the reason. No tag means agent-doable.

## Completed phases (2026-06-10 and earlier)

MVP, Phase 1, and Phase 1.5 all shipped by 2026-06-10 — full entries preserved in [docs/ledger/ROADMAP_SHIPPED.md](./docs/ledger/ROADMAP_SHIPPED.md).

## Recently Completed

Completed work is indexed in [docs/ledger/ROADMAP_SHIPPED.md](./docs/ledger/ROADMAP_SHIPPED.md) (most recent: 2026-10-22 — app auto-updates Tier 2 (version check + APK prompt); 2026-10-21 — app auto-updates Tier 1 (expo-updates OTA), deeper gamification, suppress foreground notifications, realtime resubscribe on resume, on-theme currency presets, real-device smoke test, Phase 2 spend-approved trigger).

Last audit 2026-10-21: retired the stale pb-download Known Issue to a fixed-with-workaround note, migrated MVP/Phase 1/1.5 rollups into the shipped ledger, removed Phase 2's already-archived ✅ bullets, surfaced the orphaned force-stopped-push finding, and added 14 gated backlog/infra items.

## Known Issues

- **Flaky integration test: savings goal "achieved" (found 2026-10-25)** — `phase1.integration.test.ts` › "savings goals: achieved when the balance crosses the target" fails in about 1 of 3 `just test-all` runs, with or without the 2026-10-25 changes (reproduced on the old hooks; seen again during 2026-10-28 queue validation). The goal reads `achieved: false` right after the crossing adjustment. Adding instrumentation makes it pass, which points to timing (hook ordering or after-commit timing in `goals.pb.js`). Report failures; do not hide them with retries.

- **`pocketbase/pocketbase` upstream has tags with no Release objects (found 2026-08-17)** — `just pb-download` now handles this: authenticated `releases/latest` lookup (gh/GITHUB_TOKEN) with a Homebrew fallback on macOS and actionable manual options elsewhere (fixed 2026-08-17, `a197def` + `8be6569`; docs updated). Remaining gap: non-macOS hosts during an upstream zero-Releases stretch still need a manual download — a tag-tarball/`go build` fallback is the possible follow-up.
- **Dependabot alerts blocked upstream (2026-10-23)** — both come in only through `@expo/cli`, a dev-time CLI that never ships in the APK: `node-forge` ≤ 1.4.0 (#62, GHSA-86w9-cpqp-85rv; no patched release exists) and `zod` 3.25.76 (#79; the fix is 4.6.6+ only, and forcing zod 4 into `@expo/cli` risks breaking it). Re-check on the next Expo SDK bump. The zod 4 copy (via `eslint-plugin-react-hooks`) is fixed by a `pnpm.overrides` entry.

## Recommended Next 3

**Top two require a human** (family-facing reachability is the bottleneck, not code). The real-device smoke test (previous #1) shipped 2026-10-21 — see the shipped ledger. Best agent-doable items are listed below the top 3.

1. **Phase 2: Family Link API grant in production** — additive CLI deployed and verified on bb (2026-10-28). The approval queue, worker, parent status/manual UI, and `update-service` deployment wiring are implemented locally. Next: deploy and enable the queue, then verify a real approved purchase. See [deployment](docs/DEPLOYMENT.md#enable-automatic-grants). 🧑 needs-human: deployment/sudo, real kid/tablet mapping, and approval of a real purchase.
   - ✅ Pricing + per-kid IDs (2026-10-25, migration `1717000019`): `households.screen_rate` (parentBucks/min, 0 = 1:1), `spend_requests.screen_minutes` (presets 15/30/45/60 only; more than an hour = more requests), and `users.fl_child_id`/`fl_device_id` (parent-set on web + mobile). A create hook prices screen time server-side and ignores the client's `amount`. Kid spend dialog + simplified mode have preset buttons. No cap on spending, by design; per-kid rates are still undecided.
   - ✅ Host tooling (2026-10-25): `just fl-host-setup` installs Node 24 (NodeSource), Playwright Firefox/Chromium, the script, the session and the API key on bb; `just fl-host-grant` runs a test grant via `systemd-run` as `paydirt`, outside the PocketBase unit's limits. The script now takes the child/device IDs as arguments. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#family-link-grants).
   - ✅ Session moves between machines (2026-10-28): a session signed in on the Mac granted 60 s from bb in headless Playwright Firefox (HTTP 200), so bb doesn't need the Mac.
   - ✅ Additive fix deployed and verified (2026-10-28): installed CLI/helper hashes match the Mac. A real host grant preserved 59 s and added 60 s, setting 119 s (HTTP 200). The helper reads the target device's active override using Google's server time, rounds remaining seconds up, and prevents writes on invalid reads.
   - Implemented locally, **not deployed**: approval commits a queued state and publishes a private request; `paydirt-fl.path` starts a separate serialized worker; the minute cron repairs missed publication and imports `grant_status`/`grant_error`. Interrupted/failed writes require manual review, never automatic replay. Both parent apps show results and manual completion. `update-service` ships code/units; auth refresh stays in `fl-host-setup`. Default off until `FL_AUTOMATION_ENABLED=1`.
   - ✅ Local validation: 14 worker tests, 32 integration tests (including 6 isolated queue tests), 6 Playwright E2E tests, ledger verification, workspace/native tests, lint, and typechecks pass. Tim's normal-terminal `just test-all` completed successfully; the sandbox browser restriction is not a remaining test blocker.
   - Still open: how long the session lives with only occasional grants (consider a daily keep-alive).
2. **Off-LAN access (Tailscale)** — `EXPO_PUBLIC_POCKETBASE_URL` is a LAN IP; devices can't reach PocketBase on 5G or outside the home. Tailscale is the lowest-friction fix: private mesh VPN, no public exposure, point the URL at the Tailscale hostname. Required before the family can use the app outside the house, and a prerequisite for app auto-updates to reach devices off-LAN. ~2-4 hrs.
   - 🧑 needs-human: Tailscale account + per-device enrollment (the env-var change itself is trivial)
3. **Tier 2 app auto-updates (on-device validation)** — agent-doable pieces shipped 2026-10-22 (endpoint, poll, download, install intent, `just publish-apk`); remaining work is confirming the install prompt lands and the APK actually installs on GrapheneOS. 🧑 needs-human.

### Best agent-doable next

1. **Host PayDirt on bb — remaining pieces** — the service itself is in place (`just install-service` / `just update-service`, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)). Still to do: scheduled backups of `/var/lib/paydirt` to a second location, and pointing `just publish-apk` / `just update-publish` at bb instead of local `pb_data/updates`. ~2-3 hrs.
   - 🧑 needs-human: bb SSH access + sudo for the first install
2. **Go live on bb with a real household** — bb still runs the seeded test data imported from the Mac. Add a host reset recipe (back up, then wipe `/var/lib/paydirt` to an empty DB; `just reset-db` is Mac-only), plus a `just go-live` onboarding path that creates the real household, parents and kids without `seed.mjs` or the admin UI. Re-enter `fl_*` IDs and re-point devices afterwards. Depends on the backup work in #1. ~3-4 hrs.
   - 🧑 needs-human: real names/accounts; re-login on every device
3. **Wire Android unit tests into `just test`/CI** — see [Quality & Infrastructure](#quality--infrastructure) #6; ~1-2 hrs.
4. **PocketBase backup recipe** — see [Quality & Infrastructure](#quality--infrastructure) #7; ~1-2 hrs.
5. **Feature explanation tooltips** — see [Backlog](#backlog-unscheduled). Settings don't explain themselves; ~2-3 hrs.

## Phase 2 — Family Link Automation

**Status: API-first; spike proven 2026-10-25.** The accessibility-service path is shelved: on the Pixel 8, Family Link is installed in a separate GrapheneOS profile from PayDirt, and a service in one profile can't see another profile's apps. The live session also fixed two latent bugs in the service, so it is ready if ever revived: wrong parent package name (`familylinkparental` → `familylink`, now `FamilyLinkPackages`) and tapping with no pending grant (now `GrantArm`, 60 s window), plus a `PayDirtDump` view-tree logger for label tuning.

- **API grant spike** — shipped 2026-10-25 (see the [shipped ledger](docs/ledger/ROADMAP_SHIPPED.md)); type `10` replacement behavior and additive preservation verified 2026-10-28. Session lifetime remains open.
- **API grant in production** — see [Recommended Next 3](#recommended-next-3) #1.
- **Accessibility fallback (shelved)** — `FamilyLinkAccessibilityService.kt`; only revisit if the API path dies. Would require PayDirt + a push distributor in the same profile as Family Link.
- **Manual fallback** — retained regardless; users who don't have/need Family Link still get the approval flow.

## Phase 3 — Custom MDM

- Android Device Policy Controller; programmatic screen time without Family Link
  - 🧑 needs-human: device enrollment and provisioning can't be validated without hardware

## Phase 4 — Allowance / Payments

- Configurable reward types: in-app currency, Venmo, bank transfer, manual — all with in-app record-keeping
  - 🧑 needs-human: Venmo/bank integrations need real accounts and credentials. The in-app-currency and manual record-keeping paths are agent-doable on their own
- **Google Wallet kids balance (idea, 2026-08-26)** — "Wallet for kids" (per Google's own in-app description): parents set up a balance for a kid, kid gets their own tap-to-pay payment card, parent gets transaction notifications + remote spending controls + can remove the payment method remotely. Kid can't check out online or "across Google" (Wallet-only, no browser/app checkout) — tap-to-pay in physical stores only. Requires an "eligible device" (unconfirmed what that means for GrapheneOS/LineageOS — likely a Play Services / SafetyNet-style requirement, which is exactly what this stack avoids everywhere else). At 13 the kid can opt to convert it to a self-managed Google Account, so this is explicitly a bridge feature, not a permanent arrangement. Idea: a parentBucks payout option that converts virtual currency to a real-money top-up of the kid's Wallet balance, at a configurable conversion rate — same shape as the existing "more screen time" manual-grant payout, but real money instead. Not yet scoped; needs a feasibility spike first (does topping up the balance have an API, or is it manual-only through the Google Wallet app? fees? does it actually work on a degoogled device, or does that kill this path immediately? what happens to the balance/history at the 13 handoff?) before any design or implementation work.
  - 🧑 needs-human: requires a Google account with the Wallet kids feature (and a kid device to test "eligible device" against) to research feasibility; conflicts with the project's no-Google-Play-Services stance (see *Key Concepts* in [AGENTS.md](./AGENTS.md)) and needs a decision on whether that tradeoff is acceptable for this one payout path
- **Reloadable prepaid card (idea, 2026-08-26)** — alternative to the Google Wallet angle above: a physical reloadable prepaid card (e.g. Greenlight, GoHenry, or a plain reloadable Visa/Mastercard gift card product) instead of tying the payout to a specific Google account or device. Same parentBucks-to-real-money conversion idea, but the parent reloads the card's balance instead of a Wallet balance. Upsides worth weighing against the Wallet route: no Google/Play-Services dependency at all (so it sidesteps the "eligible device" question entirely), works with any physical card the kid carries, and a lost/damaged card is just a card — cancel and reissue, no device or account entanglement. Tradeoffs: probably needs a real card-issuing platform (Greenlight/GoHenry are kid-focused and likely have their own app + spending controls, which may duplicate what PayDirt already does; a generic reloadable gift card may not support programmatic reloads at all). Needs its own feasibility spike: which providers support API-driven reloads vs. manual-only, monthly/per-card fees, minimum age, and whether a provider's own parental-control app would compete with or complement PayDirt's.
  - **Current lean (2026-08-26): plain reloadable gift card, minimal fees, not a full kid-banking service like Greenlight/GoHenry** — avoids paying for/running a parallel parental-controls app that duplicates PayDirt. Main open concern is doing the reload itself safely in an automated way (unattended card-reload API/flow, without hardcoding funding-source credentials in `pb_hooks` or anywhere else in the repo) — that's the crux of the feasibility spike, more than provider selection.
  - 🧑 needs-human: requires researching/signing up for a real card-issuing provider (fees, KYC, likely a real bank/funding account) to evaluate feasibility

## Quality & Infrastructure

Added 2026-08-10. Items 1-4 were fully agent-doable — no hardware, no new accounts — and all four shipped 2026-08-12 – 2026-08-17 (CI pipeline, ledger integrity verifier, cron/scheduled-job test coverage, offline/unreachable-backend UX — entries preserved in [docs/ledger/ROADMAP_SHIPPED.md](./docs/ledger/ROADMAP_SHIPPED.md)). Item 5 was split: Tier 1 (expo-updates OTA) shipped 2026-10-21 — see the shipped ledger; Tier 2 (native APK prompt) remains. Items 6-7 added 2026-10-21.

5. **App auto-updates Tier 2 — version check + APK prompt (no Play Store)**
   - Tier 1 (`expo-updates` OTA for JS/TS/components) shipped 2026-10-21. Tier 2 agent-doable pieces shipped 2026-10-22: `GET /api/updates/version` + `GET /api/updates/apk` endpoints (PocketBase hook, `lib/updates.js`), mobile polling (`apps/mobile/lib/appUpdate.ts`), DownloadManager install intent (`PayDirtNative.downloadAndInstallApk` + `REQUEST_INSTALL_PACKAGES`), and `just publish-apk`. The updates hook was refactored into `lib/updates.js` (top-level bindings aren't visible inside routerAdd handlers in this Goja runtime) and its root corrected to `$app.dataDir()/updates`.
   - Native changes (`FamilyLinkAccessibilityService.kt`, new native deps, SDK bumps) still need a cable or this fallback; Android forces a user tap on install, no way around it.
   - 🧑 needs-human: final validation that the install prompt lands and the APK actually installs on GrapheneOS. The endpoint, poll, download, and intent wiring are done.

6. **Wire Android unit tests into `just test` + CI** — `ForegroundTrackerTest.kt` (4 JUnit cases) runs via `./gradlew :app:testDebugUnitTest` only; the shipped entry (2026-10-21) noted it isn't in `just test`/CI. Add a justfile target, call it from `just test` or CI (CI has no JDK today — add a setup-java step if wired into the workflow). ~1-2 hrs.
7. **PocketBase backup recipe** — once real family data lives here, there's no automated backup. Add `just backup` (PocketBase `pb export`/`pb dump` of SQLite + storage into a timestamped artifact) and document a cron/launchd line in `pocketbase/README.md`. Restore path should be smoke-tested once. ~1-2 hrs.

## Backlog (unscheduled)

Ordered by impact-to-effort (2026-10-21 audit). New items that audit: everything from *Approval queue photo grid* through *Maestro E2E*.

- **Feature explanation tooltips** — shipped 2026-10-22: shared `FEATURE_TIPS` map in `packages/shared/src/featureTips.ts`; web hover ⓘ on HouseholdSettings fields; mobile ⓘ + dialog for Calm mode in KidDetail.
- **Parent mobile parity** — shipped 2026-10-22: household settings screen + ledger tab added to mobile ParentHome (recent activity still web-only).
- **Approval queue photo grid** — shipped 2026-10-22: inline thumbnails (web + mobile) with tap-to-enlarge lightbox so parents verify photos without opening each request.
- **In-app ledger view** — shipped 2026-10-22: web '📒 Ledger' tab with per-kid + month filter and net total.
- **Kid "I need help" flag** — shipped 2026-10-22: `needs_help` field on assignments, kid tap (KidHome + SimpleKidHome) notifies parents via ntfy, cleared on mark-done/approve; shown in approval queues (web + mobile).
- **Auto-save to savings goals** — shipped 2026-10-22: `auto_save_percent` on savings_goals, mobile goal form input, notification on earn with the slice; migration 1717000018.
- **Kid weekly recap** — shipped 2026-10-22: `runKidWeeklyRecap` sends each kid a Sunday ntfy with earnings, chores completed, and nearest goal progress; vacation-mode gated; manual trigger `kid-recap`.
- **Screen-time grant expiry** — "more screen time" grants currently live forever as records. Add per-grant expiry (N hours/days) so the parent ledger self-cleans and grant history stays honest; does not touch Family Link itself, just PayDirt's bookkeeping. ~3-4 hrs.
- **Timed chores** — optional `timer_minutes` on a chore, set when the chore is created or edited (web + mobile), for time-based tasks like reading 20 min, instrument practice, dribbling outside, or art projects. The kid taps Start and gets a countdown (a big ring in simplified mode); "I did it!" unlocks at zero. Store `timer_started_at` on the assignment rather than in the app, so backgrounding or restarting the app doesn't reset the countdown. Send a local notification at completion (no FCM needed). Pause/resume and a "time logged" line in the approval queue let parents sanity-check it; otherwise it runs on the honor system, since the tablet usually isn't with the kid while they dribble. Open questions: allow pauses or require continuous time, and whether partial time earns a partial reward. ~4-6 hrs.
- **Scheduled allowance ("payday")** — shipped 2026-10-22: household allowance_amount/cadence + daily cron grant (manual trigger `allowance`), notifies kids.
- **Remaining smoke-test device checks** — parent login surface and UI-tapped non-photo "I did it!" were left open at the 2026-10-21 device session (see [docs/DEVICE_TESTING.md](./docs/DEVICE_TESTING.md)). ~1 hr.
  - 🧑 needs-human: physical device + manual observation
- **Background push delivery when force-stopped** — smoke-test finding (2026-10-21): a force-stopped app drops UnifiedPush messages until relaunch. Investigate GrapheneOS delivery constraints (job scheduler/app-standby vs. a persistent foreground service), decide between a fix and a documented limitation, and write it into the setup docs either way. ~3-5 hrs.
  - 🧑 needs-human: on-device GrapheneOS behavior observation to confirm any fix actually lands
- **TalkBack accessibility pass** — labels, focus order, and touch-target sizes across kid + parent mobile surfaces (simplified mode especially, since it's aimed at a 6-year-old). Audit, fix, and document remaining gaps. ~2-3 hrs.
  - 🧑 needs-human: on-device TalkBack validation
- **Maestro E2E for kid flow** — integration + Playwright cover the shared/web stack, but the mobile kid journey (login → simplified mode → complete → parent approve → balance tick) has no automated end-to-end coverage. Maestro flows on an emulator, optionally in CI behind `workflow_dispatch` like `just test-all`. ~4-6 hrs.
- **Android home-screen widget** — glanceable kid balance + next due chore without opening the app (Glance/AppWidget). High kid delight, but native surface + device validation. ~4-6 hrs.
  - 🧑 needs-human: on-device widget validation
- **UnifiedPush self-hosted ntfy** — when ready to move off ntfy.sh, re-register on device → new endpoint URL encodes the self-hosted server automatically. No server-side config needed.
  - 🧑 needs-human: VPS provisioning + on-device re-registration
- **iOS build** — Expo project is cross-platform; main blocker is Apple developer account + TestFlight distribution. No code changes needed.
  - 🧑 needs-human: paid Apple developer account
- **Off-LAN access (Tailscale)** — see [Recommended Next 3](#recommended-next-3). 🧑 needs-human: Tailscale account + per-device enrollment
