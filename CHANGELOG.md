# Changelog

All notable changes to PayDirt. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Notification deep links (Android): tapping a push notification opens the relevant screen instead of just dismissing. On-device confirmation of the tap flow is still owed.
- Offline/unreachable-backend UX: the mobile app detects an unreachable PocketBase, shows a banner with manual retry, retries automatically on reconnect, and keeps last-known data visible instead of blanking.
- Test coverage for scheduled jobs (reminders, deadline escalation, currency expiry, weekly digest, streak milestones) via injectable-clock functions in `packages/shared`.
- Ledger integrity verifier: `just verify-ledger` recomputes every user's balance from `currency_transactions` and diffs it against the cached value; wired into `just test-all` / CI.
- CI pipeline (GitHub Actions): lint + typecheck + unit tests on every push/PR; integration + e2e via `workflow_dispatch` against a self-contained ephemeral PocketBase.
