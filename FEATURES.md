# Features

**TL;DR:** This tracks PayDirt's implemented and planned features. See [ROADMAP.md](./ROADMAP.md) for rollout status and priorities.

## Implemented

- **Data model** — MVP collections ([docs/DATA_MODEL.md](./docs/DATA_MODEL.md)) as a verified PocketBase migration; TypeScript mirror in `packages/shared`.
- **Access rules** — household-scoped API rules for all collections; guard hook blocks kids from self-approving chores.
- **Currency hooks** — chore approval earns parentBucks, spend approval deducts, Kudos credits, ledger maintains cached balance, over-spending blocked, re-approval idempotent.
- **Notification hooks** — ntfy fires for chore assigned/completed/approved/rejected, Kudos awards, and spend submitted/resolved. Topics set per user; end-to-end delivery confirmed.
- **Shared client** (`packages/shared`) — typed PocketBase wrapper (auth, chores, assignments, currency, Kudos, spend). Integration-tested against live server.
- **Web dashboard** (`apps/web`, Next.js) — parent login, kids' balances, pending approvals (approve/reject), spend requests (approve/deny), create/assign chores, per-kid adjustment and Kudos action.
- **Mobile app** (`apps/mobile`, Expo + react-native-paper) — role-gated; kid screen (balance, chores, mark done, spend request); simplified mode for young kids; runs on emulator.
- **Simplified mode** — `SimpleKidHome` screen with giant text/buttons for early readers; branches on `simplified_mode` user field.
- **Bonus/deduction UI** — `AdjustControl` per kid in the parent dashboard; calls `adjustBalance()`.
- **Kudos** — a parent gives a child a configurable positive "Great work" bonus with optional reason. The immutable award writes a distinct non-expiring ledger type, sends a push, plays one cross-device celebration, and appears as private kid history + count badge. Parent controls ship on web and mobile; Overview shows a separate total.
- **Ledger view** — web "📒 Ledger" tab (per-kid + month filter, net total) and a mobile ledger tab show the full transaction history.
- **photo_required enforcement** — server guard (`guards.pb.js`) rejects completion without a photo; `KidHome` shows camera button for photo-required chores (`expo-image-picker`).
- **Chore repeat limits** — optional `max_per_period` per chore (and every starter chore); assigning a kid past it prompts "assign anyway?" in web and mobile. Advisory only.
- **Chore notes** — optional plain-text instructions (up to 1,000 characters) in web/mobile create and edit forms, copied through templates and shown on kid cards and approval rows. Existing assignments display the current chore note.
- **Starter chores** — curated chores by age band (4-6, 7-9, 10-12, 13+) in `packages/shared/src/starterChores.ts`; web Chores tab picker skips ones already added, and `just go-live` can seed whole bands.
- **Approval undo** — "Recently approved" section in dashboard; `undoApproval()` moves the assignment back to completed and a server hook writes the compensating ledger entry (double-undo impossible; kids blocked from touching approved chores).
- **Partial credit** — parent-only percentage approval on web/mobile, with 25/50/75% picks and a custom percentage. Grit scales to two decimals; minutes round down to five-minute steps. Approval closes the chore and counts as done (including race resolution); no remainder stays open. Zero-payout percentages are rejected. Undo reverses the actual payout; time grants remain irreversible. Validation is deferred.
- **Real-time updates** — kid screens subscribe to their assignments + balance via PocketBase realtime (`subscribeToKidUpdates()`); approvals appear without pull-to-refresh. SSE polyfill (`react-native-sse`) on mobile.
- **Household broadcast** — parent sends a one-liner to all kids from the dashboard; `broadcasts` collection + ntfy fan-out hook; only parents can send. The other parent gets the full text (attributed to the sender) and the kids can answer with one-tap canned replies (`broadcast_replies`), which push to both parents.
- **Integration test suite** — live API tests for the shared client and every PB hook/guard (currency math, undo reversal, photo guard, balance guard, role guards, broadcast rules, realtime). `just test-integration`.
- **Playwright e2e** — dashboard golden path (create → assign → complete → approve → undo) and broadcast UI. `just test-e2e`.
- **ntfy kill-switch** — `NTFY_DISABLED=1` suppresses all sends so test runs don't blast the real public topics.
- **Rejected-chore flow** — kids reply to rejections (`kid_response`, parents notified + shown in dashboard) or resubmit; resubmission requires a freshly uploaded photo, enforced server-side. Simplified mode gets a big "Try again 📷" button.
- **Collapsible history** — kid history is an accordion, closed by default, capped at the 50 most recent approvals (paged query, not getFullList).
- **Deadlines + escalating reminders** — optional `due_at` per chore; cron escalates 24h → 2h → overdue (parents pinged on overdue).
- **Recurring due days** — daily due time, weekly weekday/time, or monthly day/time on chores and templates (server-local timezone). Each new assignment snapshots its next deadline; overdue chores stay open at full pay and reminders escalate once per stage. Monthly days clamp to month end. Validation is deferred.
- **Race mechanic** — race chores assigned to everyone; first approval wins, the rest auto-close with a "who won" notification.
- **Kid-proposed chores** — kids pitch a chore + asking price; parents approve at a negotiated reward (auto-creates chore + assignment) or decline.
- **Savings goals** — kid-created targets with progress bars; hook marks achieved + notifies both sides when the balance crosses the target.
- **Bank threshold** — one-time ntfy nudge to the kid when their balance crosses the household threshold.
- **Currency expiry** — optional: earn entries older than N days lapse via compensating adjustments (daily cron), capped at current balance.
- **Goods conversion display** — household `goods_rate` (bucks per $1) shown on spend requests and the kid's spend dialog.
- **Per-chore pay mode** — each chore (and template) pays bucks, screen minutes, or both (`pay_mode`, `reward_minutes`); change it any time, it applies to future approvals. Minutes go through the Family Link queue as `time_grants` with the same manual fallback; approval of a chore that granted time can't be undone. Web + mobile forms, badges on chore cards, kid views and approvals. Plan: [bonus-minutes-and-time-asks](docs/plans/bonus-minutes-and-time-asks.md).
- **Screen-time requests** — kids pick 15/30/45/60 min (both kid UIs); the server prices it at the household `screen_rate` (bucks per minute, default 1:1). Opt-in Family Link approval grants use a serialized worker; both parent UIs show results and manual completion. Host rollout remains in [ROADMAP Phase 2](ROADMAP.md#phase-2--family-link-automation).
- **Scheduled chore reminders** — per-chore "HH:MM"; cron reminds assigned kids once a day.
- **Approval nudges** — parents pinged when a completion sits unapproved longer than `nudge_hours`.
- **Approval reactions** — parents react with an emoji from "Recently approved"; shown in the kid's history.
- **Kid reminders** — kids set one-shot reminders (30m / 1h / 3h / tomorrow morning) on their own chores.
- **Chore swap** — kid offers a chore to a sibling, who accepts (takes ownership) or declines; guarded server-side.
- **Streak bonuses** — consecutive earn-days tracked per kid (🔥 shown in both apps); milestone bonuses at 3/7/14/30 days.
- **Weekly digest** — Sunday-evening ntfy summary to parents (per-kid chores, earned/spent, balances, pending approvals).
- **Vacation mode** — household pause switch suspends cron reminders, nudges, digest, and expiry.
- **Household settings panel** — currency name, bank threshold, expiry days, goods rate, screen rate, nudge hours, quiet hours, allowance, Kudos default, streak bonuses, vacation mode — all in the dashboard, with instant ⓘ tips.
- **Dev tooling** — `just fresh` starts PB + web + Expo in one command with emulator check, health polling, and cache clear; `just stop` kills everything including the emulator app; `just fresh nuke=1` wipes node_modules and reseeds. `just seed`, `just reset-db`, `just lint`, `just typecheck`.
- **CI pipeline** — GitHub Actions runs lint + typecheck + unit tests on every push/PR; integration + e2e (against a self-contained ephemeral PocketBase) run on `workflow_dispatch`.
- **Ledger integrity verifier** — `just verify-ledger` recomputes every user's balance from `currency_transactions` and diffs it against the cached value; non-zero exit on mismatch. Runs as part of `just test-all` / CI.
- **Scheduled-job test coverage** — fire/no-fire decision logic for reminders, deadline escalation, currency expiry, weekly digest, and streak milestones extracted into `packages/shared` as pure, clock-injectable functions, with vacation-mode-gated unit tests. `pb_hooks` can't import `packages/shared` (Goja has no TS/ESM support), so `scheduler.js`/`streaks.js`/`balanceReactions.js` mirror the same logic by hand, each pointing back at its tested counterpart.
- **Offline/unreachable-backend UX** — mobile app detects an unreachable PocketBase (`apps/mobile/lib/reachability.ts`), shows a banner with manual retry, retries automatically on reconnect, and keeps last-known balance/data visible instead of blanking.
- **Notification deep links (Android)** — tapping a push notification opens the relevant screen via a `paydirt://` deep link (`apps/mobile/lib/deepLinks.ts`); JS routing logic is unit-tested, verified on-device 2026-10-21 (warm and cold start).

- **Alerts inbox** — every push is also logged to a per-user `inbox` (bell in web and both mobile UIs; ✕ removes one, "Clear all"); items older than 30 days are pruned.
- **Scheduled allowance** — household `allowance_amount`/`allowance_cadence` (daily/weekly) paid by cron, with kid notification.
- **Kid weekly recap** — Sunday ntfy to each kid: earnings, chores completed, nearest savings goal.
- **"I need help" flag** — kid taps it on a chore; parents are pinged and see it in the approval queue.
- **Auto-save to goals** — `auto_save_percent` on a savings goal diverts that slice of each earn.
- **Approval photo grid** — inline photo thumbnails with tap-to-enlarge in both approval queues.
- **Quiet hours** — household window that holds back pushes (still logged to the inbox).
- **Screen-time delivery windows (first slice)** — weekday/weekend household windows in web/mobile settings hold queued purchases and chore bonuses until allowed server-local hours. Blank means unrestricted. Parent views and kid My Bank show unlock information; successful delivery sends a kid notification. Already-published jobs continue normally. Further scope and deferred validation are tracked in ROADMAP.
- **Backups + in-app updates** — nightly PocketBase backups (7 kept) and APK self-update from the host (`just ship`); see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).
- **Parent Overview** — chart-icon modal (web + mobile): paid vs. potential for a week/month/year, screen-time vs. real-money redemptions, per-kid chores, streak and earnings, weekly potential.
- **Kid My Bank** — both kid homes show available grit after pending requests, dollar/screen-minute equivalents, estimated rewards awaiting approval, streak, and savings-goal progress. Goals share the bank balance rather than reserving separate pots; no sibling information is shown. Validation is deferred.
- **In-app update** — the app downloads the new APK in-process with progress, then hands it to the installer (survives the "Install unknown apps" restart).

## Not Yet Implemented

- **Off-LAN access** — devices reach PocketBase only on the home LAN; see [ROADMAP.md](./ROADMAP.md).

## MVP Target

**Chores**
- Create/edit/delete chores (name, description, reward)
- One-off and recurring (daily, weekly, custom cadence)
- Assign to one or multiple children
- Status flow: assigned → completed (child) → approved/rejected (parent)
- Rejection notification with optional parent message
- Optional photo proof on completion

**Kid app**
- View assigned chores
- Mark complete (with optional photo)
- View parentBucks balance
- Submit spend request (parent notified immediately)
- Spend request history

**Parent app (web + Android)**
- Dashboard: pending approvals, chore status, balances
- Manage chores and assignments
- Approve/reject completions
- Approve/deny spend requests

**Currency**
- Configurable currency name and per-chore reward
- Earned on parent approval
- Spend flow: request → approve/deny → deduct

**Notifications (ntfy)**
- Child: chore assigned, spend approved/denied, chore rejected
- Parent: chore pending approval, spend request submitted
- Configurable topic per user
