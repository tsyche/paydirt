# Roadmap

## TL;DR

PayDirt is live on bb. Only completed work belongs in the [shipped ledger](docs/ledger/ROADMAP_SHIPPED.md). Implemented work with outstanding acceptance stays active in the [acceptance plan](docs/plans/feature-acceptance.md). Recurring due days are next, followed by mobile journey coverage and remaining edit-panel fixes.

Scope checklist: [FEATURES.md](./FEATURES.md). **This file is the authoritative
status tracker.**

**Doability tags:** items an agent can't start on its own are marked
`🧑 needs-human:` with the reason. No tag means agent-doable.

Last audited 2026-11-04 against source, tests, and implementation commits. Duplicate proposals were consolidated; premature completion claims were returned to active acceptance, and resolved reports were separated from remaining defects. No new feature ideas were added. Development ports remain 3110–3119.

## Known Issues

- **Dependabot glob cancellation bypass (#81, reported 2026-11-04)** — `pnpm-lock.yaml` resolves glob 13.0.6; versions through 14.0.1 allow filesystem traversal after an AbortSignal timeout. Review the transitive callers and upgrade through a compatible dependency update to patched 14.0.2 or later. [Alert](https://github.com/tsyche/paydirt/security/dependabot/81).

- **Remaining edit-panel controls** — add descriptive headers and pinned Save/Cancel to chore edits and the remaining settings forms on web/mobile. Follow [the edit-panel rule](AGENTS.md#key-concepts). Review the actual screens; earlier completed conversions are recorded in the ledger.
- **`just test-all` seed step fails intermittently (found 2026-11-02, unexplained)** — [pocketbase/seed.mjs](pocketbase/seed.mjs) dies with a generic 'Something went wrong' while creating `child2`, in about half of 8 runs on 2026-11-02, then passed on retry; 67 runs in a loop (idle, CPU-loaded, recipe-exact setup) never reproduced it. The failures clustered around concurrent `just ship` builds and hand-edited `scheduler.js` swaps. Diagnostics added 2026-11-02: `test-all` now runs PocketBase with `--dev` and dumps the last 40 log lines on any failure, and the seeder prints the failing status and URL. Next time it fails, read that output and fix the cause; if it never recurs in a few weeks, drop this entry.
- **PocketBase download fallback on non-macOS** — when upstream tags have no Release assets, non-macOS setup still requires manual installation. Add a supported fallback or document the manual path; preserve the existing macOS fallback. Entry point: [justfile](justfile).
- **Recheck dismissed development-tool dependency alerts** — review the previous zod/deepmerge dismissals when Expo changes and remove temporary overrides when upstream versions make them unnecessary. Previous alert decisions are preserved in the ledger; no fresh vulnerability assessment was performed in this roadmap cleanup.

## Recommended Next 3

1. **Recurring due days: verify and finish** — next at the owner's request. The implementation already exists; verify daily/weekly/monthly deadlines, household timezone and DST, month-end clamping, template prefill, assignment snapshots, and overdue/recurrence behavior. Add missing automated coverage and fix observed gaps rather than rebuilding the feature.
2. **Mobile journey coverage** — implement the existing [Maestro E2E item](#backlog-unscheduled), including chore creation and suggestion approval as regression journeys. Component/API checks missed the hidden create form. Emulator execution is required; no scheduled CI run is requested.
3. **Remaining edit-panel UX** — finish the existing [known issue](#known-issues): descriptive headers and pinned Save/Cancel on the remaining chore/kid/settings edit forms, then verify the actual surfaces.

## Release checks for implemented work

These are verification/deployment tasks, not features to implement again. Specific missing evidence and the returned original records are in the [acceptance plan](docs/plans/feature-acceptance.md).

- **Banked time and action alerts** — deploy backend/worker together and the new APK, then verify split rewards at closing time and linked in-app/Android alert cleanup. Backend regression coverage exists; native/device acceptance remains open.

- **Recurring due days** — active verification above. 🧑 needs-human: final native tap-through unless an emulator is available.
- **Kudos, notes, partial credit, My Bank, and direct bonus controls** — source/UI entry points exist; finish deferred device checks before claiming full rollout.
- **Delivery windows and timed chores** — verify per-day settings round-trip, timezone/DST boundaries, queued release at opening time, and timer restart behavior. School-time/downtime interaction still needs its own check.
- **Latest mobile fixes** — verify invalid bonus-minute feedback and Approvals → suggested chore → editable modal → Create and approve / Cancel on the new APK. Rendered-component checks pass; native tap-through is not yet recorded.
- 🧑 needs-human: deployment and real-device confirmation for any unverified release above. Browser launch is blocked in the current macOS runner; see [test guidance](AGENTS.md#development).

## Phase 2 — Family Link Automation

The API grant path and manual fallback are implemented; historical milestones are in the [ledger](docs/ledger/ROADMAP_SHIPPED.md). The accessibility-service alternative remains shelved unless the API path stops working.

- **Delivery follow-ups** — individual queued-grant “Hold until…” for one-off changes; Family Link schedule import with preview/apply after protocol verification; optional per-window caps. Existing weekday/weekend defaults, day exceptions, and multi-range editors are implemented.
- **Remaining daily Family Link time** — show each kid's current remaining daily screen time in the parent kid detail on web and mobile. First verify whether the existing authenticated Family Link API exposes a reliable remaining-time value and what it includes (base allowance, bonus time, device usage, school-time/bedtime restrictions, and multiple devices). Display the source's last-updated time and an unavailable/stale state; never infer remaining time from PayDirt grants alone. Keep Google session material on bb and return only the needed summary. API feasibility and comparison against a real tablet remain unverified; device confirmation needs a human.
  - Repository investigation: the only captured/read parser (`remainingBonusSeconds`) measures the active type-10 bonus using Google's server clock. It does not establish total daily remaining time. No total-time UI is added until authenticated read-only evidence can be compared with a real tablet; bb commands remain owner-run.
  - 🧑 needs-human: authenticated read-only observation and comparison against a real tablet.

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

Remaining operational work; deployment observations belong in the shipped ledger, not this list.

8. **Backup restore drill** (2026-11-01) — nightly PocketBase zips and `backup-pull` exist, but no one has restored one. Add `just restore-drill`: unzip the newest pulled backup into an ephemeral PocketBase on a free port, boot it, run `just verify-ledger` against it, and report pass/fail; document the manual restore steps in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Never touches bb. ~1-2 hrs. **Gotchas:** use the port block (3110-3119), not bb's port; pulled backups contain real household data, so keep the unzip dir under `$TMPDIR` and delete it after; the PocketBase binary version must match the one that wrote the backup.

9. **Nightly ledger-verify alert** (2026-11-02) — `just verify-ledger` only runs by hand and in `test-all`, so a balance that drifts from `currency_transactions` on bb goes unnoticed. Run the same recompute daily on bb (a systemd timer or a `pb_hooks` cron calling the check) and send a parent ntfy only on a mismatch, naming the kid and the difference. ~1-2 hrs. 🧑 needs-human: deploy to bb. **Gotchas:** read-only; never auto-correct a balance; quiet when clean so it can't become noise.

## Parent parity (web ↔ mobile)

**Rule (2026-11-01):** every parent-facing capability ships on both web and mobile in the same change, or the gap is logged here with a reason. Kid-only surfaces are mobile-only by design. Acceptance for any parent feature: the same fields, validation and confirmations on both, and shared logic in `packages/shared`.

Verify parent capabilities on both surfaces; pending checks are listed in the [acceptance plan](docs/plans/feature-acceptance.md).

- **Screen-by-screen parity pass (2026-11-02)** — compare web and mobile directly rather than by keyword: create/edit chore, templates, thresholds, household settings, kid detail. List every field, validation and confirmation that differs, fix the cheap gaps in the same change, and log the rest here. Include the new settings menu item and grit dialog. ~2 hrs.

## Backlog (unscheduled)

Ordered by impact-to-effort (2026-11-01 audit). Shipped items live in the ledger, not here.

- **Overview reassessment (2026-11-02)** — reassess after a few weeks of real use: (a) dollar figure in the app header; (b) kid-facing lifetime totals ("grand total accomplished"); (c) actual-vs-potential trend across weeks; (d) heatmap (parked): kids see only their own, parents get a household grid. Open: reprice pending spend requests on approval (default no; prices lock at request time).

- **Parent alerts for economy thresholds (2026-11-02)** — informational ntfy to parents, never blocking, when something drifts past a limit they set: (a) a kid's weekly potential (dollars) above a ceiling, e.g. $40, which fires when chores are assigned or repriced, not daily; (b) actual weekly earnings or screen minutes bought or earned above a ceiling, checked in the weekly digest or after the day's approvals. Household settings: per-kid or household "alert above $/week" and "alert above screen min/week", both off by default. One alert per kid per threshold per week (dedupe marker) so it can't nag; suppressed in vacation mode. Reuses `weeklyPotential`/`householdWeeklyBucks`, `bankView` and the period sums in `overview.ts`, so the numbers match the Overview. Parity: the settings go on web and mobile together. **Gotcha:** the potential figure is a perfect-compliance ceiling and reads high, so tie the threshold to it knowingly, or alert on actuals as the primary signal.

- **Expiry warnings for kids (2026-11-02)** — when `expiry_days` is on, ntfy the kid a week and a day before grit lapses ("40 Grit expires in 7 days; spend it or lose it"). Expiry is tracked per earn row by its `created` date, so each chore's grit has its own clock. The daily cron computes what will actually lapse in the next 7 days and 1 day, and dedupes (a warned-at marker per kid and window) so it never repeats. Reuse the existing `expiryLapse` for the lot-remaining data: share one pure function in `packages/shared` for the cron, the warning and a "expiring soon" line in the kid bank card. Suppressed during vacation mode. Kudos grit is excluded.

- **Expiry dry-run preview (2026-11-02)** — before a parent turns `expiry_days` on (or changes it), settings shows 'N grit would lapse today' per kid, computed with the shared `expiryLapse` against the live ledger, so the first cron run is never a surprise. Read-only; web and mobile together. ~1-2 hrs.

- **Tappable badges with details (2026-11-02)** — badges on the kid shelf aren't tappable today. Tap for what the badge is, how it was earned (or progress toward it) and when. Mobile kid surface only; small and independent of kudos, though the kudos badge would use it.

- **Household shopping list / "we're out of X" requests** (2026-11-02) — kids and parents flag missing household items; parents get one de-duplicated list with Bought / Dismiss and the kid gets a push back. No grit reward. Draft: [docs/plans/shopping-list.md](docs/plans/shopping-list.md). Parent list must ship on web and mobile together.

- **Overview weekly potential looks high (2026-11-02)** — it is a perfect-compliance ceiling (every daily chore, every day, no missed days). add a realistic figure next to it, such as the trailing 4-week actual average per week, once there are a few weeks of real data.

- **Kid ↔ parent messaging, next steps** (2026-11-01) — (a) a short free-text reply (~140 chars) with a rate limit and a mute option, only if canned replies prove too limiting; (b) formalize the kids' goal-text back channel as a "note to parents" field with an inbox badge.

- **Kid "ask for more time"** — the kid ask button with a parent reply sheet that offers a bonus chore, suggested chores/minutes, parent-triggered nudges, and a daily bonus-minutes cap. Rejected for now: kid picks bucks or time, staleness premiums, automatic nudges. Full design: [docs/plans/bonus-minutes-and-time-asks.md](docs/plans/bonus-minutes-and-time-asks.md).
- **Team chores (do it together)** — a chore kids do jointly, like helping cook dinner, where each participating kid earns the full reward (the opposite of `race`, where only the first approval pays). A non-race chore assigned to several kids already pays each one separately, but they complete and get approved separately, so a parent approves twice for one shared effort. Add a `team` flag that groups the assignments: either kid marks it done for the group (or each confirms), the parent approves once, and every member's assignment pays in the same step. Reuse the race hook's sibling-assignment lookup in `races.pb.js`. Open questions: whether one kid skipping drops only their share, whether the reward splits or stays full per kid (full here), and how a team chore counts against `max_per_period` and streaks (once per kid). `team` and `race` should be mutually exclusive in the forms. ~4-6 hrs. **Gotchas:** a team chore pays every member in full, so it doubles the cost the budget assumed (the ~$91/month worst case treats chores as independent); an approved time grant can't be undone, so undo for a team approval must either be blocked outright or reverse every member's payout together, never half; one kid who never confirms can block the group, so the parent needs a drop-a-member action; the race hook's sibling-assignment lookup keys on race semantics and must not close teammates' assignments; per-kid limits and streaks count once per member; old APKs won't know the flag, so confirm the app handles an unknown group status.
- **Activity heatmap (year-at-a-glance)** (2026-11-01) — a GitHub-style contribution calendar: one small box per day for the last ~52 weeks, shaded by approved chore count that day, with a hover/tap tooltip ("Tue 3 Nov: 4 chores, +12 bucks"). Sits beside the existing Activity report (monthly numbers) as the visual trend: streaks, dry spells, and busy weeks show up without reading a table. Data already exists (approved `assignments.approved_at`, plus `currency_transactions` for the tooltip's bucks), so no schema change.
  - **Decided:** the heatmap ships for both parents and kids, rendered differently: parents see one household grid (all kids combined); kids see only their own activity, never a sibling's. Intensity is chore count, not bucks, so a big one-off doesn't wash out the scale. Calm and simple modes get a short "this month" strip instead of the full year.
  - **Build:** a pure shared function (`bucketByDay(rows, range)` plus a 0-4 intensity scale, unit-tested like `summarizeMonthActivity`) and a thin renderer per platform: CSS grid on web, `View` grid on mobile. Parity rule applies to the parent view (web and mobile together); the kid view is mobile-only. ~4-6 hrs.
  - **Later, maybe:** a per-kid filter on the parent grid.
- **Screen-time grant expiry** — "more screen time" grants currently live forever as records. Add per-grant expiry (N hours/days) so the parent ledger self-cleans and grant history stays honest; does not touch Family Link itself, just PayDirt's bookkeeping. ~3-4 hrs.
- **Family Link session keep-alive** (2026-11-01) — the copied Google session is only used on occasional grants, and how long it lives that way is unknown. Add a daily no-op authenticated call from bb (a read-only Family Link request via the existing worker script) that logs success or failure and sends a parent ntfy when the session has lapsed, so expiry shows up before a kid's purchase fails. Optional: a parent-visible "session last verified" line next to the grant status. ~1-2 hrs. **Gotchas:** keep it read-only (never a write); one call per day to avoid looking like automation abuse; it needs the `paydirt-fl` environment on bb, so deploy and verify are 🧑 needs-human; add a unit test for the lapsed-session path.
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
- **Off-LAN access (Tailscale)** — `EXPO_PUBLIC_POCKETBASE_URL` is a LAN IP; devices cannot reach PocketBase or APK updates on 5G/outside home. Tailscale is the lowest-friction private-mesh fix; point the URL at the Tailscale hostname. ~2-4 hrs. 🧑 needs-human: Tailscale account + per-device enrollment.
