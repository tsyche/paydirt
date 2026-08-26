# Roadmap

Scope checklist: [FEATURES.md](./FEATURES.md). **This file is the authoritative
status tracker.**

Original design scratchpad (rationale + alternatives considered, not status):
`~/.claude/plans/archive/paydirt-plan.md` — archived 2026-08-10, formerly
`~/.windsurf/plans/choregalore-plan.md`.

**Doability tags:** items an agent can't start on its own are marked
`🧑 needs-human:` with the reason. No tag means agent-doable.

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

## Recently Completed

1. ✅ **Notification deep links (2026-08-17)** — `UnifiedPushReceiver.kt` attaches a `PendingIntent` carrying the payload's `type` as a `paydirt://` deep link; `App.tsx` wires `Linking` (cold + warm start) to route to the relevant screen. JS routing logic is unit-tested; native tap-through is **not yet confirmed on a device**. See *Phase 2* for a related, still-open gap this work does **not** close.
2. ✅ **Offline/unreachable-backend UX (2026-08-17)** — mobile app detects an unreachable PocketBase (`apps/mobile/lib/reachability.ts`), shows a banner with manual retry, retries automatically on reconnect, and keeps last-known data visible instead of blanking. See *Quality & Infrastructure* #4.
3. ✅ **Scheduled-job test coverage (2026-08-17)** — fire/no-fire decision logic for reminders, deadline escalation, currency expiry, weekly digest, and streak milestones extracted into `packages/shared` as pure, clock-injectable functions, with vacation-mode-gated unit tests. `pb_hooks` mirrors the same logic by hand (Goja has no TS/ESM support). See *Quality & Infrastructure* #3.
4. ✅ **Ledger integrity verifier (2026-08-12)** — `just verify-ledger` recomputes balances from `currency_transactions` and diffs against the cache; wired into `just test-all`/CI. See *Quality & Infrastructure* #2.
5. ✅ **CI pipeline (2026-08-12)** — `.github/workflows/ci.yml`: `checks` job runs `just lint`, `just typecheck`, `just test` on every push and PR; `integration-e2e` job (`workflow_dispatch`) runs `just test-all` against a self-contained ephemeral PocketBase. See *Quality & Infrastructure* #1.

<details>
<summary>Earlier completions (2026-06-10 — 2026-07-06)</summary>

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

</details>

## Known Issues

_Doc drift (dangling plan references, stale Expo SDK number) was fixed 2026-08-10._

- **`pocketbase/pocketbase` has zero GitHub Releases (found 2026-08-17)** — the upstream repo currently has tags (e.g. `v0.39.11`) but no Release objects. `just pb-download` calls `releases/latest` via the GitHub API and gets nothing back, so it fails; the `releases` links in `README.md` and `pocketbase/README.md` 404 for the same reason. Immediate workaround: `brew install pocketbase` (the Homebrew formula builds from the tag's source tarball, unaffected) then `ln -sf $(brew --prefix)/bin/pocketbase pocketbase/pocketbase`. Fixing `pb-download` itself (e.g. building from the tag tarball via `go build`) is a job for `/audit-workflow`.

## Recommended Next 3

**⚠️ All three require a human.** They're still genuinely the top priorities —
nothing ships to the family without them — but no autonomous run can start any
of them. See *Best agent-doable next* below for parallel work.

1. **Real-device smoke test** — emulator works; GrapheneOS/LineageOS hasn't been validated. Prerequisite for Phase 2. Run the full flow (login → chore → complete → approve → spend) on a physical device over wireless adb. ~2 hrs.
   - 🧑 needs-human: physical GrapheneOS/LineageOS device + manual observation
2. **Phase 2 live test with Family Link** — build a release APK on a real device with Family Link installed. Enable the accessibility service via the new in-app prompt, approve a spend request, and verify the service auto-taps "Grant Bonus Time". Tune button-label matching if Family Link's UI differs. **Blocked until *Phase 2*'s "Wire the trigger" item ships** — right now no broadcast ever fires, so this test would fail trivially regardless of device/account setup. ~half day.
   - 🧑 needs-human: physical device + a real Family Link account
3. **Off-LAN access (Tailscale)** — `EXPO_PUBLIC_POCKETBASE_URL` is a LAN IP; devices can't reach PocketBase on 5G or outside the home. Tailscale is the lowest-friction fix: private mesh VPN, no public exposure, point the URL at the Tailscale hostname. Required before the family can use the app outside the house. ~2-4 hrs.
   - 🧑 needs-human: Tailscale account + per-device enrollment (the env-var change itself is trivial)

### Best agent-doable next

1. **Wire the Phase 2 notification trigger** — see *Phase 2*'s "Wire the trigger" item. Small (~30 min) but it's the one piece standing between the accessibility service and ever actually firing.
2. **On-theme currency presets** — see *Backlog*. ~1 hr, no dependencies.

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

**Status: scaffolded, but the trigger wiring itself is still unbuilt — this was previously (and inaccurately) described as complete.** Prerequisite for live validation: real-device smoke test + Family Link live test.

Server-side delivery is correct: the spend-approval hook already sends `type: "spend_approved"` in the ntfy payload (`notifications.pb.js`). `FamilyLinkAccessibilityService.kt` is written and registered, listening for a local `ACTION_GRANT_SCREEN_TIME` broadcast. **But nothing has ever sent that broadcast** — `UnifiedPushReceiver.kt` didn't parse the payload's `type` field at all until the notification-deep-links work (2026-08-17), and even now it only uses `type` to build the tap-to-open deep link, not to drive the accessibility service. The `notification → broadcast → accessibility tap` chain has never actually connected end to end. Still needs:

- **Wire the trigger** — in `UnifiedPushReceiver.kt`, send a local `ACTION_GRANT_SCREEN_TIME` broadcast when the payload's `type` is `spend_approved` (alongside the existing deep-link handling, not instead of it). This is the missing link; no hardware needed to write or unit-test the JS/Kotlin logic around it. ~30 min.
- ✅ **In-app enable prompt** — banner in `ParentHome` Settings tab detects service state via flag file; deep-links to Accessibility Settings.
- **Live device validation** — build APK, enable service, approve spend request, verify tap automation works. Tune button labels if Family Link's UI differs from assumed text. Blocked on "Wire the trigger" above — without it, this test fails trivially (no broadcast ever fires). ~half day.
  - 🧑 needs-human: physical device + a real Family Link account
- **Stretch: reverse-engineered Family Link API** — direct HTTP grant without the Accessibility Service; fragile but faster UX.
  - 🧑 needs-human: requires a live Family Link account to observe the traffic
- **Manual fallback** — retained regardless; users who don't have/need Family Link still get the approval flow.

## Phase 3 — Custom MDM

- Android Device Policy Controller; programmatic screen time without Family Link
  - 🧑 needs-human: device enrollment and provisioning can't be validated without hardware

## Phase 4 — Allowance / Payments

- Configurable reward types: in-app currency, Venmo, bank transfer, manual — all with in-app record-keeping
  - 🧑 needs-human: Venmo/bank integrations need real accounts and credentials. The in-app-currency and manual record-keeping paths are agent-doable on their own
- **Google Wallet kids balance (idea, 2026-08-26)** — "Wallet for kids" (per Google's own in-app description): parents set up a balance for a kid, kid gets their own tap-to-pay payment card, parent gets transaction notifications + remote spending controls + can remove the payment method remotely. Kid can't check out online or "across Google" (Wallet-only, no browser/app checkout) — tap-to-pay in physical stores only. Requires an "eligible device" (unconfirmed what that means for GrapheneOS/LineageOS — likely a Play Services / SafetyNet-style requirement, which is exactly what this stack avoids everywhere else). At 13 the kid can opt to convert it to a self-managed Google Account, so this is explicitly a bridge feature, not a permanent arrangement. Idea: a parentBucks payout option that converts virtual currency to a real-money top-up of the kid's Wallet balance, at a configurable conversion rate — same shape as the existing "more screen time" manual-grant payout, but real money instead. Not yet scoped; needs a feasibility spike first (does topping up the balance have an API, or is it manual-only through the Google Wallet app? fees? does it actually work on a degoogled device, or does that kill this path immediately? what happens to the balance/history at the 13 handoff?) before any design or implementation work.
  - 🧑 needs-human: requires a Google account with the Wallet kids feature (and a kid device to test "eligible device" against) to research feasibility; conflicts with the project's no-Google-Play-Services stance (see *Key Concepts* in CLAUDE.md) and needs a decision on whether that tradeoff is acceptable for this one payout path
- **Reloadable prepaid card (idea, 2026-08-26)** — alternative to the Google Wallet angle above: a physical reloadable prepaid card (e.g. Greenlight, GoHenry, or a plain reloadable Visa/Mastercard gift card product) instead of tying the payout to a specific Google account or device. Same parentBucks-to-real-money conversion idea, but the parent reloads the card's balance instead of a Wallet balance. Upsides worth weighing against the Wallet route: no Google/Play-Services dependency at all (so it sidesteps the "eligible device" question entirely), works with any physical card the kid carries, and a lost/damaged card is just a card — cancel and reissue, no device or account entanglement. Tradeoffs: probably needs a real card-issuing platform (Greenlight/GoHenry are kid-focused and likely have their own app + spending controls, which may duplicate what PayDirt already does; a generic reloadable gift card may not support programmatic reloads at all). Needs its own feasibility spike: which providers support API-driven reloads vs. manual-only, monthly/per-card fees, minimum age, and whether a provider's own parental-control app would compete with or complement PayDirt's.
  - **Current lean (2026-08-26): plain reloadable gift card, minimal fees, not a full kid-banking service like Greenlight/GoHenry** — avoids paying for/running a parallel parental-controls app that duplicates PayDirt. Main open concern is doing the reload itself safely in an automated way (unattended card-reload API/flow, without hardcoding funding-source credentials in `pb_hooks` or anywhere else in the repo) — that's the crux of the feasibility spike, more than provider selection.
  - 🧑 needs-human: requires researching/signing up for a real card-issuing provider (fees, KYC, likely a real bank/funding account) to evaluate feasibility

## Quality & Infrastructure

Added 2026-08-10. Items 1-4 were fully agent-doable — no hardware, no new accounts — and all four shipped 2026-08-12 – 2026-08-17. Item 5 remains.

1. ✅ **CI pipeline (GitHub Actions)** (2026-08-12)
   - `.github/workflows/ci.yml`: `checks` job runs `just lint`, `just typecheck`, `just test` on every push and PR. `integration-e2e` job (gated on `workflow_dispatch`) runs `just test-all`, which boots its own ephemeral PocketBase, seeds, and runs integration + e2e — no manual setup, no secrets.

2. ✅ **Ledger integrity verifier (2026-08-12)**
   - `just verify-ledger` (`pocketbase/verify-ledger.mjs`) recomputes every user's balance from `currency_transactions` and diffs it against the cached value; non-zero exit on mismatch. Diff logic lives in `packages/shared/src/ledger.ts` (unit-tested, including a deliberately-corrupted-balance case). Wired into `just test-all`, so it runs in CI's `integration-e2e` job alongside the other integration checks.

3. ✅ **Cron/scheduled-job test coverage (2026-08-17)**
   - Fire/no-fire decision logic for reminders, deadline escalation, weekly digest, currency expiry, and streak milestones extracted into `packages/shared/src/{scheduling,streaks}.ts` as pure, clock-injectable functions, vacation-mode-gated tests included. `pb_hooks` can't import `packages/shared` (Goja has no TS/ESM support), so `scheduler.js`/`streaks.js`/`goals.pb.js` mirror the same logic by hand, each pointing back at its tested counterpart.

4. ✅ **Offline / unreachable-backend UX (2026-08-17)**
   - `apps/mobile/lib/reachability.ts` detects an unreachable backend, shows a plain "can't reach home" banner instead of an error toast, retries automatically on reconnect, and keeps last-known data visible rather than blanking it.

5. **App auto-updates (no Play Store)**
   - Kids' devices currently only update by plugging in a cable. No Play Services means no Play Store auto-update, no Play Core in-app update API, no Firebase App Distribution — the whole conventional path is out.
   - **Tier 1 — `expo-updates` OTA.** Covers JS/TS, components, business logic, styling. Does *not* require EAS; point `updates.url` at a self-hosted manifest (PocketBase can serve it). Silent, no user interaction — which is the entire point, since the users are 6 and 11 and will not reliably tap through an installer.
   - **Tier 2 — version check + APK prompt.** For native changes (`FamilyLinkAccessibilityService.kt`, new native deps, SDK bumps) that OTA structurally cannot deliver. App polls a version endpoint, downloads, fires an install intent. Needs `REQUEST_INSTALL_PACKAGES`; Android forces a user tap, no way around it.
   - **Configure rollback as part of tier 1, not after.** A bad JS bundle remotely bricks the app on every kid's device simultaneously. `expo-updates` supports rollback but only if set up deliberately.
   - Alternatives considered: self-hosted F-Droid repo (proper no-Google answer, but real infrastructure and the kids need the F-Droid client) and Obtainium pointed at GitHub releases (near-zero server work, fiddly against a private repo).
   - **Sequence after the real-device smoke test and off-LAN access** — the update check needs to reach a server, and building a delivery pipeline before confirming the app runs on GrapheneOS is backwards.
   - ~3-4 hrs per tier, ~1 day for both
   - 🧑 needs-human: final validation that an update actually lands on a GrapheneOS device. The client wiring, manifest endpoint, and rollback config are all agent-doable.

## Backlog (unscheduled)

- **Deeper gamification (full "playful" mode)** — the design refresh landed a playful-but-grown-up baseline (tactile buttons, claim hero, coin-pop on approval). Architecture (`Celebration`, `ChunkyButton`, palette packs) is built to dial *up* toward a fuller Duolingo-style experience. Candidate additions: a household mascot, richer celebration sequences (XP-style count-up on the claim hero), badge/achievement shelf, streak-freeze mechanic, sound effects (opt-in), and an optional per-kid "max playful" intensity. Keep parent surfaces calm (the Slate pack); scope playful escalation to the kid views. Gate behind a setting so parents control the dial. ~1-2 days.
- **On-theme currency presets** — `currency_name` is already per-household configurable; consider shipping themed default suggestions (e.g. Nuggets, Gold, Grit, Karats) and a richer default than "parentBucks" to match the Goldrush identity. ~1 hr.
- ✅ **Notification deep links** — shipped 2026-08-17; see *Recently Completed*.
- ✅ **Second parent support** — migration adds create rule so any parent can add a co-parent in Settings; seed includes `parent1@test.local` + `parent2@test.local`; `notifyParents` already fans out to all parents.
- ✅ **ntfy onboarding flow** — shipped 2026-06-28; `NtfySetup` modal + `lib/ntfy-onboarding.ts`.
- **UnifiedPush self-hosted ntfy** — when ready to move off ntfy.sh, re-register on device → new endpoint URL encodes the self-hosted server automatically. No server-side config needed.
  - 🧑 needs-human: VPS provisioning + on-device re-registration
- **iOS build** — Expo project is cross-platform; main blocker is Apple developer account + TestFlight distribution. No code changes needed.
  - 🧑 needs-human: paid Apple developer account
- **Off-LAN access (Tailscale)** — see Recommended Next 3. 🧑 needs-human: Tailscale account + per-device enrollment
