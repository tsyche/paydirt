# Changelog

All notable changes to PayDirt. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- On-theme currency presets: the household currency default is now **Grit** (was "parentBucks"), with one-click presets (Grit, Nuggets, Gold, Karats) in household settings. Display fallback is centralized in `packages/shared/src/currency.ts`.
- Phase 2 trigger: a spend-approval push (`type: "spend_approved"`) now broadcasts `ACTION_GRANT_SCREEN_TIME` locally so the Family Link accessibility service can launch Family Link and auto-tap its grant button. The notification, deep link, and broadcast all fire together; chain verified on-device (broadcast reaches the service in ~10 ms; the final Family Link tap still needs a real Family Link account to validate).
- Notification deep links (Android): tapping a push notification opens the relevant screen instead of just dismissing. Verified on-device 2026-10-21 (warm: lands KidHome; cold: process killed → tap → cold start).
- Offline/unreachable-backend UX: the mobile app detects an unreachable PocketBase, shows a banner with manual retry, retries automatically on reconnect, and keeps last-known data visible instead of blanking.
- Test coverage for scheduled jobs (reminders, deadline escalation, currency expiry, weekly digest, streak milestones) via injectable-clock functions in `packages/shared`.
- Ledger integrity verifier: `just verify-ledger` recomputes every user's balance from `currency_transactions` and diffs it against the cached value; wired into `just test-all` / CI.
- CI pipeline (GitHub Actions): lint + typecheck + unit tests on every push/PR; integration + e2e via `workflow_dispatch` against a self-contained ephemeral PocketBase.

### Fixed
- Realtime staleness after backgrounding or network blips: a silently-died SSE socket (no EventSource error, so the PocketBase SDK never auto-reconnects) left kid/parent screens without live updates — sometimes for tens of minutes — until remount. The app now forces a socket rebuild + catch-up reload on foreground and on offline→online (`useRealtimeResume`; rebuild keeps registered subscription listeners, so existing subscribers keep receiving events).
- UnifiedPush registration: the app sent the legacy `org.unifiedpush.android.connector.REGISTER` action, which modern ntfy silently ignores. Registration now uses `org.unifiedpush.android.distributor.REGISTER`, so ntfy actually replies with an endpoint — root cause of the "Check connection" setup dead-end.
- Photo completion: marking a photo-required chore done uploads via a native multipart PATCH (`expo-file-system` legacy `uploadAsync`) instead of failing with `ClientResponseError 0`.
- Endless flashing pull-to-refresh on kid screens: syncing `up_endpoint` rewrote the child's own auth record on every launch; the resulting `authStore.onChange` re-render re-triggered the sync in a loop, and each write also fired the realtime subscription → reload. The sync now skips unchanged endpoints, and the App effect depends on `userId`/`userRole` instead of user-object identity.
