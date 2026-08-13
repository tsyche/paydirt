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

1. ✅ **CI pipeline (2026-08-12)** — `.github/workflows/ci.yml`: `checks` job runs `just lint`, `just typecheck`, `just test` on every push and PR; `integration-e2e` job (`workflow_dispatch`) runs `just test-all` against a self-contained ephemeral PocketBase. See *Quality & Infrastructure* #1.
2. ✅ **Toolchain upgrade (2026-07-06)** — TypeScript 6, vitest 4, Expo SDK 57, Next.js 16. React stays pinned at 19.2.3 via `pnpm.overrides`.
3. ✅ **Co-parent support (2026-07-06)** — migration adds a create rule so any parent can add a co-parent in Settings; seed ships `parent1@test.local` + `parent2@test.local`; `notifyParents` already fanned out to all parents.
4. ✅ **Node 26.4.0 upgrade (2026-07-06)** — `.tool-versions` bump, minor dep bumps, doc staleness pass. Note: Node 26+ no longer bundles corepack.
5. ✅ **Accessibility service in-app prompt (2026-07-06)** — Settings tab in `ParentHome` detects whether `FamilyLinkAccessibilityService` is enabled via flag file (`lib/accessibility-service.ts`); shows amber banner with "Open Accessibility Settings" deep-link when off, green status card when active. `backgroundService.ts` dead import cleaned up; mobile vitest wired up.
6. ✅ **ntfy onboarding flow (2026-06-28)** — detects if the ntfy app is installed on first launch; if not, prompts "Install ntfy" (opens Play Store); once installed, a config wizard lets the parent choose public ntfy.sh vs. self-hosted, persisted via AsyncStorage. `NtfySetup` component + `lib/ntfy-onboarding.ts`.

<details>
<summary>Earlier completions (2026-06-10 — 2026-06-17)</summary>

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

## Recommended Next 3

**⚠️ All three require a human.** They're still genuinely the top priorities —
nothing ships to the family without them — but no autonomous run can start any
of them. See *Best agent-doable next* below for parallel work.

1. **Real-device smoke test** — emulator works; GrapheneOS/LineageOS hasn't been validated. Prerequisite for Phase 2. Run the full flow (login → chore → complete → approve → spend) on a physical device over wireless adb. ~2 hrs.
   - 🧑 needs-human: physical GrapheneOS/LineageOS device + manual observation
2. **Phase 2 live test with Family Link** — build a release APK on a real device with Family Link installed. Enable the accessibility service via the new in-app prompt, approve a spend request, and verify the service auto-taps "Grant Bonus Time". Tune button-label matching if Family Link's UI differs. ~half day.
   - 🧑 needs-human: physical device + a real Family Link account
3. **Off-LAN access (Tailscale)** — `EXPO_PUBLIC_POCKETBASE_URL` is a LAN IP; devices can't reach PocketBase on 5G or outside the home. Tailscale is the lowest-friction fix: private mesh VPN, no public exposure, point the URL at the Tailscale hostname. Required before the family can use the app outside the house. ~2-4 hrs.
   - 🧑 needs-human: Tailscale account + per-device enrollment (the env-var change itself is trivial)

### Best agent-doable next

1. **Ledger integrity verifier** — small, self-contained, directly protects the currency invariant.
2. **Offline / unreachable-backend UX** — partial mitigation for #3 above that needs no Tailscale account.

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

**Status: scaffolded. Prerequisite: real-device smoke test + Family Link live test.**

The notification pipeline (`UnifiedPushReceiver.kt` + `up_endpoint` server-side delivery) is complete. `FamilyLinkAccessibilityService.kt` is now written and registered — it listens for `ACTION_GRANT_SCREEN_TIME` broadcasts (fired by `UnifiedPushReceiver` when a `spend_approved` message arrives) and walks the view hierarchy to tap "Grant Bonus Time". Still needs:

- ✅ **In-app enable prompt** — banner in `ParentHome` Settings tab detects service state via flag file; deep-links to Accessibility Settings.
- **Live device validation** — build APK, enable service, approve spend request, verify tap automation works. Tune button labels if Family Link's UI differs from assumed text. ~half day.
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

## Quality & Infrastructure

Added 2026-08-10. Items 1-4 are fully agent-doable — no hardware, no new accounts. Item 1 shipped 2026-08-12.

1. ✅ **CI pipeline (GitHub Actions)** (2026-08-12)
   - `.github/workflows/ci.yml`: `checks` job runs `just lint`, `just typecheck`, `just test` on every push and PR. `integration-e2e` job (gated on `workflow_dispatch`) runs `just test-all`, which boots its own ephemeral PocketBase, seeds, and runs integration + e2e — no manual setup, no secrets.

2. **Ledger integrity verifier**
   - Currency drift is currently silent. If a PocketBase hook throws mid-transaction, the cached balance and the ledger entries diverge with nothing to catch it.
   - `just verify-ledger` recomputes every kid's balance from `currency_ledger` entries and diffs it against the cached value; non-zero exit on mismatch. Wire into CI once that exists.
   - Done when a deliberately corrupted balance is detected by the command.
   - ~2-3 hours effort

3. **Cron/scheduled-job test coverage**
   - Reminders, deadline escalation, weekly digest, currency expiry, and streak milestones are all time-dependent, all untested, and all fail *silently* — a broken cron just quietly stops notifying.
   - Inject the clock rather than sleeping. Cover vacation-mode gating for each job, since that's the shared branch most likely to regress.
   - Done when each scheduled job has a test that advances a fake clock and asserts fire/no-fire.
   - ~3-4 hours effort

4. **Offline / unreachable-backend UX**
   - `EXPO_PUBLIC_POCKETBASE_URL` is a LAN IP, so a kid opening the app on 5G hits an unhandled failure today. This is the cheap half of the Tailscale item and needs no account.
   - Detect unreachable backend, show a plain "can't reach home" state instead of an error, retry on reconnect, and keep the last-known balance visible rather than blanking it.
   - Done when the app degrades legibly with PocketBase stopped.
   - ~2-3 hours effort

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
- **Notification deep links** — tapping a push notification opens the relevant screen (e.g. approval notification → approvals section). Currently notifications are fire-and-forget with no intent payload. Needs `PendingIntent` in `UnifiedPushReceiver.kt` + React Native Linking. ~2-3 hrs. *Writable and unit-testable without hardware, but final confirmation needs a real device — don't call it done on green tests alone.*
- ✅ **Second parent support** — migration adds create rule so any parent can add a co-parent in Settings; seed includes `parent1@test.local` + `parent2@test.local`; `notifyParents` already fans out to all parents.
- ✅ **ntfy onboarding flow** — shipped 2026-06-28; `NtfySetup` modal + `lib/ntfy-onboarding.ts`.
- **UnifiedPush self-hosted ntfy** — when ready to move off ntfy.sh, re-register on device → new endpoint URL encodes the self-hosted server automatically. No server-side config needed.
  - 🧑 needs-human: VPS provisioning + on-device re-registration
- **iOS build** — Expo project is cross-platform; main blocker is Apple developer account + TestFlight distribution. No code changes needed.
  - 🧑 needs-human: paid Apple developer account
- **Off-LAN access (Tailscale)** — see Recommended Next 3. 🧑 needs-human: Tailscale account + per-device enrollment
