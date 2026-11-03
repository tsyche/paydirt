# Kudos (parent "you did good" bonus)

**Status:** Building
**Fold into:** [FEATURES.md](../../FEATURES.md), [DATA_MODEL.md](../DATA_MODEL.md)

**TL;DR:** A parent gives a kid a subjective bonus (default 100 grit, adjustable) with an optional reason. The kid gets a push, a celebration the next time they open the app, a "Great work" badge with a running count, and a private history list. No minutes, no per-grade pay.

## Why

- Rewards effort and improvement without paying per grade (unfair to a kid with all As and one B).
- Meant for rare moments (report cards, big efforts), so a flat default is fine and cost stays small.

## MVP

- New `kudos` collection: `household`, `child`, `given_by`, `reason` (optional text), `bucks`, `seen_at` (null until the celebration plays). One row per award.
- Creating a kudos writes a ledger row with its **own transaction type** (not `manual_adjustment`), so Overview can show kudos as a separate line rather than burying it in "Parent adjustments". Done in a PocketBase hook so the row and the balance change together.
- Household setting `kudos_default_bucks` (default 100). The parent can change the amount on each award.
- **Parent action** "Give kudos": kid, reason, amount. Ships on web and mobile together (parity).
- **Kid side (mobile only):**
  - ntfy push on award, e.g. "⭐ You got a Great work bonus: report card".
  - The existing `Celebration` plays on next open when `seen_at` is null, then sets it. The flag lives on the server row, not local storage, so several tablets can't replay it.
  - One "⭐ Great work ×N" badge on the shelf; N is the count of kudos rows (derived, never a stored counter).
  - Kudos history list (reason, date, grit) next to the badge.
- Overview: kudos total as its own tile, with a dollar sub-line.

## Decisions

- Private for now: a kid sees only their own kudos. Siblings and a future competition view are a later opt-in, like `kids_see_balances`.
- Minutes are left out. Grit only; the amount is adjustable.
- Parent-entered only; kids can't claim kudos.

## Later

- Badge tiers at count thresholds.
- Sibling leaderboard or shared view as kids get older (household setting).
- Kudos preset reasons.

## Expiry and caps

- **Kudos grit never expires.** It has its own ledger type, and the expiry cron only lapses `earn` rows. Any expiry fix must keep it out of the lapse math (see the expiry items in [ROADMAP](../../ROADMAP.md)).
- No monthly cap; the parent is trusted.
