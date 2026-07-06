# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

## Recently Completed

0. ✅ **ntfy onboarding flow (2026-06-28)** — detects if ntfy app is installed on first launch; if not, prompts "Install ntfy" (opens Play Store); once installed, config wizard lets parent choose public ntfy.sh vs. self-hosted endpoint, persisted via AsyncStorage. `NtfySetup` component + `lib/ntfy-onboarding.ts`.
1. ✅ **Accessibility service in-app prompt (2026-07-06)** — Settings tab in `ParentHome` detects whether `FamilyLinkAccessibilityService` is enabled via flag file (`lib/accessibility-service.ts`); shows amber banner with "Open Accessibility Settings" deep-link when off, green status card when active. `backgroundService.ts` dead import cleaned up; mobile vitest wired up.
2. ✅ **Design system overhaul (2026-06-17)** — Fredoka display face; `ChunkyButton` tactile buttons; claim balance hero; coin-pop `Celebration`; tabbed IA on both surfaces; 5 coordinated palette packs + System/Light/Dark; `KidDetail` drill-in; CSS-sync test.
3. ✅ **Phase 2 scaffolding (2026-06-16)** — `FamilyLinkAccessibilityService.kt` with view-tree walker + broadcast receiver; registered in AndroidManifest; UP notification payload `type` field; spend-approval hook fires `spend_approved`.
4. ✅ **Currency ledger CSV export (2026-06-16)** — "Export CSV" in web `LedgerToggle`; `buildLedgerCsv` pure function with 7 unit tests.
5. ✅ **Mobile chore template parity (2026-06-16)** — collapsible template picker + "Save as template" in `ParentHome`; integration test covers create/list/delete.

<details>
<summary>Earlier completions (2026-06-10 — 2026-06-15)</summary>

- Chore edit on mobile, due date on create-chore form
- Per-kid goods rate, web chore edit, custom kid reminder times, parent mobile chore creation + sibling leaderboard
- `withUnifiedPush.js` lint fixes, multi-kid chore assignment, parent earnings/activity report, streak/expiry tuning UI
- Notification quiet hours, chore templates, parent mobile view (approvals/spend/broadcast)
- MD3 design overhaul (web + mobile), kid avatar + color
- Phase 1 + 1.5 features: races, savings goals, streaks, chore swap, weekly digest, vacation mode

</details>

## Known Issues

_None currently._

## Recommended Next 3

1. **Real-device smoke test** — emulator works; GrapheneOS/LineageOS hasn't been validated. Prerequisite for Phase 2. Run the full flow (login → chore → complete → approve → spend) on a physical device over wireless adb. ~2 hrs.
2. **Phase 2 live test with Family Link** — build a release APK on a real device with Family Link installed. Enable the accessibility service via the new in-app prompt, approve a spend request, and verify the service auto-taps "Grant Bonus Time". Tune button-label matching if Family Link's UI differs. ~half day.
3. **Off-LAN access (Tailscale)** — `EXPO_PUBLIC_POCKETBASE_URL` is a LAN IP; devices can't reach PocketBase on 5G or outside the home. Tailscale is the lowest-friction fix: private mesh VPN, no public exposure, point the URL at the Tailscale hostname. Required before the family can use the app outside the house. ~2-4 hrs.

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
- **Stretch: reverse-engineered Family Link API** — direct HTTP grant without the Accessibility Service; fragile but faster UX.
- **Manual fallback** — retained regardless; users who don't have/need Family Link still get the approval flow.

## Phase 3 — Custom MDM

- Android Device Policy Controller; programmatic screen time without Family Link

## Phase 4 — Allowance / Payments

- Configurable reward types: in-app currency, Venmo, bank transfer, manual — all with in-app record-keeping

## Backlog (unscheduled)

- **Deeper gamification (full "playful" mode)** — the design refresh landed a playful-but-grown-up baseline (tactile buttons, claim hero, coin-pop on approval). Architecture (`Celebration`, `ChunkyButton`, palette packs) is built to dial *up* toward a fuller Duolingo-style experience. Candidate additions: a household mascot, richer celebration sequences (XP-style count-up on the claim hero), badge/achievement shelf, streak-freeze mechanic, sound effects (opt-in), and an optional per-kid "max playful" intensity. Keep parent surfaces calm (the Slate pack); scope playful escalation to the kid views. Gate behind a setting so parents control the dial. ~1-2 days.
- **On-theme currency presets** — `currency_name` is already per-household configurable; consider shipping themed default suggestions (e.g. Nuggets, Gold, Grit, Karats) and a richer default than "parentBucks" to match the Goldrush identity. ~1 hr.
- **Notification deep links** — tapping a push notification opens the relevant screen (e.g. approval notification → approvals section). Currently notifications are fire-and-forget with no intent payload. Needs `PendingIntent` in `UnifiedPushReceiver.kt` + React Native Linking. ~2-3 hrs.
- ✅ **Second parent support** — migration adds create rule so any parent can add a co-parent in Settings; seed includes `parent1@test.local` + `parent2@test.local`; `notifyParents` already fans out to all parents.
- ✅ **ntfy onboarding flow** — shipped 2026-06-28; `NtfySetup` modal + `lib/ntfy-onboarding.ts`.
- **UnifiedPush self-hosted ntfy** — when ready to move off ntfy.sh, re-register on device → new endpoint URL encodes the self-hosted server automatically. No server-side config needed.
- **iOS build** — Expo project is cross-platform; main blocker is Apple developer account + TestFlight distribution. No code changes needed.
- **Off-LAN access (Tailscale)** — see Recommended Next 3.
