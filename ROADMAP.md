# Roadmap

Full detail and rationale: `~/.windsurf/plans/choregalore-plan.md`. Scope checklist: [FEATURES.md](./FEATURES.md).

## ✅ MVP — Shipped

Chore CRUD, assignment, complete/approve flow, parentBucks earn + spend, ntfy notification wiring, shared typed client, Next.js parent dashboard, Expo kid app (role-gated), live ntfy delivery confirmed end-to-end.

## Recently Completed

1. ✅ **Chore edit on mobile (2026-06-16)** — inline edit form in each chore card with all fields (name, reward, type, cadence, photo, race, reminder, due date); pencil/archive icon buttons; `client.updateChore()` wired up; deactivate with Alert confirmation.
2. ✅ **Due date on mobile create-chore form (2026-06-16)** — `due_at` text field (`YYYY-MM-DD`) added to both the create and edit forms in `ParentHome`. Due date renders in the chore list view.
3. ✅ **Phase 2 scaffolding (2026-06-16)** — `FamilyLinkAccessibilityService.kt` created with full view-tree walker + broadcast receiver; registered in AndroidManifest; `accessibility_service_config.xml` added; UP notification payload extended with optional `type` field; spend-approval hook fires `spend_approved` type to parents' UP endpoints.
4. ✅ **Currency ledger CSV export (2026-06-16)** — "Export CSV" button in the web `LedgerToggle`; downloads a kid's full transaction history. `buildLedgerCsv` extracted as a pure function with 7 unit tests.
5. ✅ **Mobile chore template parity (2026-06-16)** — `ParentHome` now shows a collapsible template picker and "Save as template" button matching the web `ChoreTemplatesPanel`. Integration test covers create/list/delete.

<details>
<summary>Earlier completions (2026-06-10 — 2026-06-15)</summary>

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
2. **Enable-accessibility-service prompt in the app** — `FamilyLinkAccessibilityService` is registered but users must enable it manually. Add a banner/button in `ParentHome` that detects when the service is off and deep-links to `Settings → Accessibility`. Requires a NativeModule or reading the flag file via `expo-file-system`. ~2-3 hrs.
3. **Phase 2 live test with Family Link** — build a release APK on a real device with Family Link installed. Manually enable the accessibility service, approve a spend request, and verify the service auto-taps "Grant Bonus Time". Tune button-label matching if Family Link's UI differs. ~half day.

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

- **In-app enable prompt** — detect when service is off and deep-link to Accessibility Settings. ~2-3 hrs.
- **Live device validation** — build APK, enable service, approve spend request, verify tap automation works. Tune button labels if Family Link's UI differs from assumed text. ~half day.
- **Stretch: reverse-engineered Family Link API** — direct HTTP grant without the Accessibility Service; fragile but faster UX.
- **Manual fallback** — retained regardless; users who don't have/need Family Link still get the approval flow.

## Phase 3 — Custom MDM

- Android Device Policy Controller; programmatic screen time without Family Link

## Phase 4 — Allowance / Payments

- Configurable reward types: in-app currency, Venmo, bank transfer, manual — all with in-app record-keeping

## Backlog (unscheduled)

- **Notification deep links** — tapping a push notification opens the relevant screen (e.g. approval notification → approvals section). Currently notifications are fire-and-forget with no intent payload. Needs `PendingIntent` in `UnifiedPushReceiver.kt` + React Native Linking. ~2-3 hrs.
- **Second parent support** — currently one parent per household is the implicit assumption (no UI to invite/add a co-parent). Schema supports multiple `parent`-role users per household; needs an invite flow. ~3-4 hrs.
- **UnifiedPush self-hosted ntfy** — when ready to move off ntfy.sh, re-register on device → new endpoint URL encodes the self-hosted server automatically. No server-side config needed.
- **iOS build** — Expo project is cross-platform; main blocker is Apple developer account + TestFlight distribution. No code changes needed.
- **Off-LAN access for mobile** — `EXPO_PUBLIC_POCKETBASE_URL` is a LAN IP; phones can't reach PocketBase on 5G or other networks. Recommended fix: Tailscale (private mesh VPN, no public exposure, point the URL at the Tailscale hostname instead of the LAN IP — fits the "family-only, no public surface" design already used for ntfy/PocketBase). Alternative: VPS + domain + HTTPS (no VPN client needed, but requires hardening a public endpoint). ~2-4 hrs for Tailscale setup + testing.
