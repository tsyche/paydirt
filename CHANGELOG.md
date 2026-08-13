# Changelog

All notable changes to PayDirt. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Ledger integrity verifier: `just verify-ledger` recomputes every user's balance from `currency_transactions` and diffs it against the cached value; wired into `just test-all` / CI.
- CI pipeline (GitHub Actions): lint + typecheck + unit tests on every push/PR; integration + e2e via `workflow_dispatch` against a self-contained ephemeral PocketBase.
