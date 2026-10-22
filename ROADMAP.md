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

Completed work is indexed in [docs/ledger/ROADMAP_SHIPPED.md](./docs/ledger/ROADMAP_SHIPPED.md) (most recent: 2026-10-21 — realtime resubscribe on resume, on-theme currency presets, real-device smoke test, Phase 2 spend-approved trigger).

## Known Issues

_Doc drift (dangling plan references, stale Expo SDK number) was fixed 2026-08-10._

- **`pocketbase/pocketbase` has zero GitHub Releases (found 2026-08-17)** — the upstream repo currently has tags (e.g. `v0.39.11`) but no Release objects. `just pb-download` calls `releases/latest` via the GitHub API and gets nothing back, so it fails; the `releases` links in `README.md` and `pocketbase/README.md` 404 for the same reason. Immediate workaround: `brew install pocketbase` (the Homebrew formula builds from the tag's source tarball, unaffected) then `ln -sf $(brew --prefix)/bin/pocketbase pocketbase/pocketbase`. Fixing `pb-download` itself (e.g. building from the tag tarball via `go build`) is a job for `/audit-workflow`.

## Recommended Next 3

**Top two require a human.** The real-device smoke test (previous #1) shipped
2026-10-21 — see the shipped ledger.

1. **Phase 2 live test with Family Link** — build a release APK on a real device with Family Link installed. Enable the accessibility service via the new in-app prompt, approve a spend request, and verify the service auto-taps "Grant Bonus Time". Tune button-label matching if Family Link's UI differs. The trigger ships and its broadcast chain is verified on-device (2026-10-21); the real-device smoke test prerequisite is met — the test itself needs Family Link + an account. ~half day.
   - 🧑 needs-human: physical device + a real Family Link account
2. **Off-LAN access (Tailscale)** — `EXPO_PUBLIC_POCKETBASE_URL` is a LAN IP; devices can't reach PocketBase on 5G or outside the home. Tailscale is the lowest-friction fix: private mesh VPN, no public exposure, point the URL at the Tailscale hostname. Required before the family can use the app outside the house, and a prerequisite for app auto-updates to reach devices off-LAN. ~2-4 hrs.
   - 🧑 needs-human: Tailscale account + per-device enrollment (the env-var change itself is trivial)
3. **App auto-updates** — see *Quality & Infrastructure* #5. Sequenced after Tailscale (the update check needs to reach a server). Client wiring, manifest endpoint, and rollback config are agent-doable; final device validation is human. ~1 day for both tiers.

### Best agent-doable next

1. **Feature explanation tooltips** — see *Backlog*. Settings don't explain themselves; ~2-3 hrs.

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

**Status: trigger wired (2026-10-21); real-device smoke test met (2026-10-21); awaiting live Family Link validation.** Remaining prerequisite: Family Link + an account (human-gated).

Server-side delivery is correct: the spend-approval hook already sends `type: "spend_approved"` in the ntfy payload (`notifications.pb.js`). `FamilyLinkAccessibilityService.kt` is written and registered, listening for a local `ACTION_GRANT_SCREEN_TIME` broadcast. The chain now connects end to end: `UnifiedPushReceiver.kt` parses the payload's `type`, posts the notification (tap-to-open deep link), and — when `type` is `spend_approved` — sends `ACTION_GRANT_SCREEN_TIME`, which the accessibility service receives and answers by launching Family Link (verified on the Pixel 8 via logcat: send → receive → launch in ~10 ms; no-op when Family Link is absent). Still needs:

- ✅ **Wire the trigger** (2026-10-21) — `UnifiedPushReceiver.kt` sends the local `ACTION_GRANT_SCREEN_TIME` broadcast on `type == "spend_approved"` (alongside the existing deep-link handling). Verified on-device: the spend payload fires the broadcast, no-type/other-type payloads don't.
- ✅ **In-app enable prompt** — banner in `ParentHome` Settings tab detects service state via flag file; deep-links to Accessibility Settings.
- **Live device validation** — service already enabled on the Pixel 8 and the broadcast chain verified; remaining work is installing Family Link, approving a spend request, and confirming the tap automation lands on Family Link's button. Tune button labels if Family Link's UI differs from assumed text. ~half day.
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
  - 🧑 needs-human: requires a Google account with the Wallet kids feature (and a kid device to test "eligible device" against) to research feasibility; conflicts with the project's no-Google-Play-Services stance (see *Key Concepts* in AGENTS.md) and needs a decision on whether that tradeoff is acceptable for this one payout path
- **Reloadable prepaid card (idea, 2026-08-26)** — alternative to the Google Wallet angle above: a physical reloadable prepaid card (e.g. Greenlight, GoHenry, or a plain reloadable Visa/Mastercard gift card product) instead of tying the payout to a specific Google account or device. Same parentBucks-to-real-money conversion idea, but the parent reloads the card's balance instead of a Wallet balance. Upsides worth weighing against the Wallet route: no Google/Play-Services dependency at all (so it sidesteps the "eligible device" question entirely), works with any physical card the kid carries, and a lost/damaged card is just a card — cancel and reissue, no device or account entanglement. Tradeoffs: probably needs a real card-issuing platform (Greenlight/GoHenry are kid-focused and likely have their own app + spending controls, which may duplicate what PayDirt already does; a generic reloadable gift card may not support programmatic reloads at all). Needs its own feasibility spike: which providers support API-driven reloads vs. manual-only, monthly/per-card fees, minimum age, and whether a provider's own parental-control app would compete with or complement PayDirt's.
  - **Current lean (2026-08-26): plain reloadable gift card, minimal fees, not a full kid-banking service like Greenlight/GoHenry** — avoids paying for/running a parallel parental-controls app that duplicates PayDirt. Main open concern is doing the reload itself safely in an automated way (unattended card-reload API/flow, without hardcoding funding-source credentials in `pb_hooks` or anywhere else in the repo) — that's the crux of the feasibility spike, more than provider selection.
  - 🧑 needs-human: requires researching/signing up for a real card-issuing provider (fees, KYC, likely a real bank/funding account) to evaluate feasibility

## Quality & Infrastructure

Added 2026-08-10. Items 1-4 were fully agent-doable — no hardware, no new accounts — and all four shipped 2026-08-12 – 2026-08-17 (CI pipeline, ledger integrity verifier, cron/scheduled-job test coverage, offline/unreachable-backend UX — entries preserved in [docs/ledger/ROADMAP_SHIPPED.md](./docs/ledger/ROADMAP_SHIPPED.md)). Item 5 remains.

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

- **Feature explanation tooltips** — settings and controls don't explain themselves (hard to know what each setting is for). Web: hover tooltips on HouseholdSettings fields, dashboard controls, and any non-obvious button. Mobile: small info (ⓘ) affordance next to settings labels that opens a one-line explanation dialog — hover doesn't exist on touch. Candidates to cover first: currency name/presets, goods rate, bank thresholds, recurring cadence, quiet hours, simplified mode, race mechanic. Copy lives in one shared map so web and mobile stay in sync. ~2-3 hrs.
- **UnifiedPush self-hosted ntfy** — when ready to move off ntfy.sh, re-register on device → new endpoint URL encodes the self-hosted server automatically. No server-side config needed.
  - 🧑 needs-human: VPS provisioning + on-device re-registration
- **iOS build** — Expo project is cross-platform; main blocker is Apple developer account + TestFlight distribution. No code changes needed.
  - 🧑 needs-human: paid Apple developer account
- **Off-LAN access (Tailscale)** — see Recommended Next 3. 🧑 needs-human: Tailscale account + per-device enrollment
