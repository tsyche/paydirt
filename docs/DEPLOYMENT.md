# Deployment (always-on host)

**TL;DR:** PocketBase serves PayDirt's API and parent dashboard on bb:3111. Run `just install-service` once, then `just update-service`; data and saved browser auth survive updates. Push delivery runs outside approval requests; Family Link has its own worker, enabled after host/session setup.

Set the household's timezone under **Household preferences** on web or mobile.
It governs calendar dates, chore resets, and schedules independently of the
host/device timezone; blank defaults to `America/Los_Angeles`. See
[calendar behavior](DATA_MODEL.md) for details.

## Contents

- [Layout on the host](#layout-on-the-host)
- [First install](#first-install)
- [Updates](#updates)
- [Operations](#operations)
- [Family Link grants](#family-link-grants)
- [Backups](#backups)
- [Publishing app updates](#publishing-app-updates)
- [Going live with a real household](#going-live-with-a-real-household)

## Layout on the host

| Path | Owner | Contents |
|---|---|---|
| `/opt/paydirt/` | root | `pocketbase` binary, [pb_hooks/](../pocketbase/pb_hooks), [pb_migrations/](../pocketbase/pb_migrations), `pb_public/` (dashboard) |
| `/var/lib/paydirt/` | `paydirt` (750) | `pb_data`: SQLite DBs, uploaded files, `updates/` (APK + OTA) |
| `/etc/paydirt/paydirt.env` | root (600, optional) | env overrides, e.g. `NTFY_SERVER=...` |
| `/etc/systemd/system/paydirt.service` | root | from [`pocketbase/paydirt.service`](../pocketbase/paydirt.service) |
| `/opt/paydirt/notifications/` | root | Push worker and shared queue helper; requires `/usr/bin/node` 24+ |
| `/var/lib/paydirt/notifications/` | `paydirt` (700) | Private pending/processing push jobs (600) and worker lock |
| `/etc/systemd/system/paydirt-notify.{path,service}` | root | Push queue watcher and worker |
| `/opt/paydirt/familylink/` | root | Family Link grant script, `playwright`, Playwright browsers (see [below](#family-link-grants)) |
| `/var/lib/paydirt/familylink/` | `paydirt` (700) | Google session (`familylink-state.json`, 600) |
| `/var/lib/paydirt/familylink/queue/` | `paydirt` (700) | Pending requests, claimed jobs, and durable result receipts (600) |
| `/etc/systemd/system/paydirt-fl.{path,service}` | root | Queue watcher and serialized grant worker, outside PocketBase's resource limits |

The unit runs as the unprivileged `paydirt` user with `ProtectSystem=strict`; only `/var/lib/paydirt` is writable.

PocketBase is capped at two CPU cores (`CPUQuota=200%`) and 768 MB RAM, with `GOMEMLIMIT=512MiB` to collect Go heaps before the hard limit forces reclaim/swap. `CPUWeight=200` gives the service extra weight under host contention.

On hosts with System76 Scheduler, deployment installs a [PayDirt-only exception](../pocketbase/paydirt-scheduler.kdl) and reloads the scheduler so it preserves the unit’s nice 0 and best-effort I/O priorities instead of assigning nice 12 and idle I/O. Other services retain their existing scheduling policies. These settings address the 2026-11-23 memory-limit stalls; they do not reserve CPU or RAM. See the [Go memory-limit guidance](https://go.dev/doc/gc-guide#Memory_limit).

It binds `0.0.0.0:3111` on all interfaces; restrict access to the trusted LAN with host/router firewall rules. The bind address itself does not enforce LAN-only access.

## First install

Install Node 24+ at `/usr/bin/node` on the Linux host before deploying. The
notification worker needs it independently of Family Link browser setup.

1. `cp deploy.example.env deploy.local.env` and set `PAYDIRT_SSH_HOST` to the host's SSH alias (`bb`).
2. Stop local PocketBase (`just stop`) so its data copies cleanly.
3. `just install-service` from a terminal (remote `sudo` prompts). It:
   - creates the `paydirt` system user and the directories above;
   - imports local `pocketbase/pb_data` **only if** the host has no `data.db` yet;
   - then does everything `update-service` does.
4. Point the apps at the host:
   - Mobile: set `EXPO_PUBLIC_POCKETBASE_URL=http://<host-ip>:3111` in `apps/mobile/.env`, then `just push-remote` for direct APK installation (the URL is baked into the APK). For a full release after committing, `just push` aliases `just ship`: update the server, publish the APK for in-app updates, then install on reachable devices. No reachable devices skips only direct installation.
   - Dashboard: `http://<host-ip>:3111/` (admin UI at `/_/`).
5. Kids' VLAN (br1) needs a router LAN Access rule allowing `192.168.20.0/24` → `<host-ip>:3111`.

## Updates

`just update-service` builds the dashboard as a static export (`NEXT_PUBLIC_POCKETBASE_URL=/`, same origin), stages it with the hooks, migrations and unit in a private temp dir on the host, then:

- installs the PocketBase version matching local `pocketbase/pocketbase --version` (override with `PB_VERSION`), verified against the release's `checksums.txt`; skipped if already current;
- syncs `/opt/paydirt/`, reinstalls the unit, restarts, and polls `/api/health` on loopback.
- ships Family Link scripts/helpers and units without copying browser auth or installing browsers; once host setup exists, starts the queue watcher and runs worker recovery.
- installs/enables the push queue watcher and worker, and recovers interrupted push jobs.

Migrations run automatically on restart. No commit or push is needed to deploy local changes.

## Operations

| Task | Command |
|---|---|
| Status | `just service-status` |
| Logs | `just service-logs [N]` |
| Restart | `just service-restart` |
| Copy backups to this Mac | `just backup-pull` |
| Deploy backend + publish APK + adb install (warns on uncommitted files) | `just ship` |
| Ship APK/OTA to the host | `just push-updates` |

### Nightly ledger check

The PocketBase scheduler checks cached Grit balances against the currency ledger
at 03:15 in the configured household timezone. Clean checks send nothing; drift
creates one parent alert per affected household, listing each affected user and
its cached balance, ledger total, and difference. It never changes balances or
transactions. Existing quiet hours apply: alerts remain in the inbox when push
is suppressed. Deploy with `just update-service`; no new unit or credentials
are needed. A superuser can run the same check with
`POST /api/paydirt/cron/ledger` for diagnosis.

### Push delivery

The deployed PocketBase unit sets `NTFY_QUEUE_DIR=/var/lib/paydirt/notifications`.
Hooks save inbox entries immediately and atomically publish private queue files;
they do not wait for ntfy. The path unit wakes the worker, which sends up to four
pushes concurrently with a ten-second timeout each. This covers chore/spend
approvals and every other caller of the shared notification helper. Existing
apps benefit without an APK update. Clearing an inbox source also removes its
pending pushes; delivery already in progress may still arrive.

Delivery remains best effort: failures log only a job ID, then discard the job;
the in-app inbox remains available. Interrupted jobs are recovered on deployment
or the next worker start; a crash after sending can replay a push. Queue files
contain private endpoints/message text and are not world-readable. Inspect
worker errors with `sudo journalctl -u paydirt-notify`; do not print queue bodies.
Local development without `NTFY_QUEUE_DIR` retains direct delivery; use
`NTFY_DISABLED=1` for tests. If opting into a local queue, run
`NTFY_QUEUE_DIR=<same-directory> node --experimental-strip-types scripts/notification-worker.mts`
to drain it.

## Family Link grants

Device verification (2026-11-04): a five-minute chore bonus granted while two
hours of ordinary daily time remained temporarily showed the bonus countdown.
After it expired, ordinary daily-time depletion resumed. The daily allowance
was not erased. Preserve existing bonus time when extending a bonus; do not add
the ordinary daily allowance into the bonus calculation.

Bonus screen time is granted through the Family Link web API ([`scripts/familylink-grant.mjs`](../scripts/familylink-grant.mjs)). Google rejects sign-in from automated browsers, so you sign in on the Mac and copy the session to the host.

Each grant reads the target device's active bonus and adds only the new minutes
that fit before the delivery window closes, accounting for bonus already
running. A 30-minute reward at 8:15 PM with an 8:30 PM close delivers 15 minutes
and queues the redeemed/purchased remainder of 15 for the next opening; held saved minutes do not enter this path. Sub-minute gaps wait for the next window;
split remainders use whole minutes. Existing bonus is never reduced.

The calculation uses Google's server time and rounds remaining seconds up.
Failed reads, missing devices, malformed responses, or unsupported active
overrides stop the grant without writing. Purchases are 15–60 minutes. New chore earnings stay held until redemption;
Use now and later redemptions take 15–60 minutes in 15-minute steps, saving any
remainder. Existing queued chore rewards and direct parent bonuses retain their
5–120-minute, five-minute-step limits. Direct bonuses use the same delivery windows and manual fallback without
changing grit. The worker and `fl-host-grant` share a host lock; do not run Mac
grants concurrently with host grants. These limits apply to bonus delivery;
they do not change Family Link's ordinary daily allowance.

1. Mac: `just fl-login` (sign in to the co-parent account by hand, then quit that Chrome). Needs `~/.config/paydirt/familylink.env` with `FL_CHILD_ID`, `FL_DEVICE_ID`, `FL_API_KEY`.
2. `just fl-host-setup [browsers]` (default `firefox`; `"firefox chromium"` for both). It is idempotent and:
   - installs Node 24 from the NodeSource apt repo if the existing Node major is below 24; an existing Node 24+ is retained;
   - installs the script, `playwright` (the Mac's version) and Playwright's own browser builds under `/opt/paydirt/familylink/`. Stock `/usr/bin/firefox` can't be used, because Playwright drives only its patched builds;
   - copies the session to `/var/lib/paydirt/familylink/` and sets `FL_API_KEY` in `/etc/paydirt/paydirt.env`.
3. `just fl-host-grant <seconds> [firefox|chromium]` runs a test grant as `paydirt` through `systemd-run`, outside the PocketBase unit's memory/CPU limits. Exit 2 = session rejected or expired.

After a new `fl-login`, re-run `just fl-host-setup` to copy the session again. Code-only changes ship through `just update-service`.

### Enable automatic grants

Deploy the queue implementation with `just update-service` before enabling it. The additive CLI was validated on bb on 2026-10-28: a real grant preserved 59 seconds and added 60, setting 119 seconds. Automatic grants were owner-confirmed in production on 2026-11-02; the steps below describe enabling them on a new host.

1. Set each child's Family Link child/device IDs in PayDirt's parent settings. Seeded accounts are test data; verify the real kid-to-tablet mapping first.
2. On bb, add `FL_AUTOMATION_ENABLED=1` to `/etc/paydirt/paydirt.env`. Leave the file root-owned, mode 600.
3. Restart `paydirt` on bb so the approval hook reads the flag. Each worker invocation reads the same environment file.
4. Approve one new screen-time purchase. Check the web/mobile parent Approvals view and `systemctl status paydirt-fl.path paydirt-fl.service`. The worker is a oneshot service, so inactive after a successful run is normal. The cron imports completed results once per minute.

When disabled or a child has no IDs, approval still deducts the purchase and shows a manual grant task. Existing approved purchases are never queued retroactively.

### Queue and failure handling

- Deploy backend migrations before the updated apps. Migration `1717000041`
  adds optional approval feedback; `1717000042` expands weekday/weekend storage
  for multiple windows while retaining existing schedules. Older apps remain
  compatible. Restore single ranges before rolling back `1717000042`; its
  rollback refuses to invalidate saved multi-range schedules. Migration
  `1717000043` adds personal archives. Apply it before the new web/APK clients;
  older clients remain usable but do not hide personally archived items. Restore
  all archives before rolling this migration back; source records and rewards
  are not removed by archiving.
- Earned-time banking and conversations additionally require migrations `1717000044`
  and `1717000045` before their new clients. New earnings stay in the held ledger;
  existing queued grants are preserved. Rollbacks refuse populated minute ledgers
  or conversations; reconcile/export their data rather than dropping history.
- Migration `1717000046` adds per-grant delivery overrides. Apply it before the
  updated web/APK clients; existing clients and workers remain compatible. Its
  rollback refuses active queued overrides; finish or reconcile them first.
- Parent Approvals has **Deliver now** for each queued grant. Confirm to bypass
  PayDirt's delivery hours for its remaining minutes only; this does not edit
  weekday/weekend schedules or bypass Family Link restrictions. It does not
  retry uncertain/manual grants. Web access needs `just update-service`; mobile
  controls also need the updated APK (`just ship` handles both).
- Approval commits `grant_status=queued` with the spend. The hook publishes a private JSON request; the minute cron repairs a missed publish and imports results.
- `paydirt-fl.path` starts the worker. It claims each request atomically and processes grants serially, with a 60-second timeout per browser command.
- Receipts stay on disk to prevent replay. Failed or interrupted grants are never retried automatically: Google may have accepted a write before the connection failed.
- Partial receipts record actual delivered seconds. The row stays queued until
  the full reward is delivered; each remainder has its own receipt key. A full
  window waits until closing before retrying at a later opening. Optional queue
  expiry still routes undelivered time to manual review.
- Deploy the backend, grant script, and worker together (`just update-service`).
  The old worker cannot process remainder receipt keys. Do not roll back the
  delivery-progress migration while partially delivered rewards are outstanding;
  preserve/settle their remaining balances first.
- Purchase `grant_status` is `queued`, `granted`, `manual`, or `manual_done`. Saved-time grants additionally support `cancelled`, only for provably unstarted reservations; `grant_error` contains a safe recovery message. No browser responses, authenticated URLs, or credentials enter these fields or worker logs.
- For `manual`, check Family Link before adding time, then use **Mark granted manually** in either parent app. Session expiry instructs the parent to run `fl-login` and `fl-host-setup`; refreshing auth does not replay failed purchases.
- Updating code stops the worker. An interrupted job becomes manual review on recovery. Keep `queue/results/` receipts; do not remove the queue to retry grants.

To disable future automatic approvals, remove `FL_AUTOMATION_ENABLED` (or set it to `0`) and restart `paydirt`. A running browser grant can still finish. New worker runs turn remaining queued jobs into manual tasks. `FL_QUEUE_DIR` is a test override; production uses the fixed directory above.

## Backups

PocketBase's built-in scheduler (set by migration `1717000023`) writes a consistent zip of the whole data dir to `/var/lib/paydirt/backups/` at 02:30 nightly and keeps the newest 7. That covers corruption and bad writes, not losing the host, so run `just backup-pull` now and then (needs sudo; keeps the newest 30 in `./backups/host/`, gitignored). Zips include the Family Link session, so treat them as secrets.

### Local recovery drill

Verified 2026-11-23 against the pulled November 23 household backup with
PocketBase 0.40.5: four users, 126 transactions, all balances match. The archive
includes creating-version metadata; no legacy version override was needed. The
temporary server and restored data were removed; no production restore occurred.

After pulling backups, run `just restore-drill`. It selects the newest ZIP by
modification time, checks ZIP/SQLite integrity and the creating PocketBase
version, then boots a private copy on a free loopback port in 3113–3119 and runs
the existing ledger verifier. It requires Python 3, Node 24+, and the matching
local PocketBase binary. An optional first argument selects a specific ZIP.

The drill never connects to bb or uses `PB_URL`. It creates a temporary superuser
only in the copy, excludes application hooks and migrations, and disables
scheduled backups, backup S3 delivery, and SMTP there. No Family Link or push
worker starts. Temporary files (mode 600, directories 700) and the server are
removed on success or failure; source archives stay unchanged. Logs report
aggregate counts, not account names, credentials, or session contents.

New backups include `paydirt-backup.json` with the creating binary's version
after deploying [the backup hook](../pocketbase/pb_hooks/backups.pb.js). The hook
was deployed and hash-verified on 2026-11-21. The November 23 scheduled ZIP
contains the version and creation timestamp, verified by `just restore-drill`.
For a legacy archive, supply its **known** version, for example:
`just restore-drill "backups/host/example.zip" --backup-version 0.40.5`.
Do not infer the old version from today's server or guess to bypass the check.
A mismatch or unrecorded version fails before the restored server starts.

Passing proves the snapshot boots and cached grit balances match its immutable
ledger. It does not establish that the backup is recent, test forward schema
migrations, or reconcile external time grants.

### Real recovery on bb

1. Record which workers were enabled, then stop `paydirt`, `paydirt-fl.path` /
   `paydirt-fl.service`, and `paydirt-notify.path` / `paydirt-notify.service`.
2. Preserve the entire current `/var/lib/paydirt` directory and select a backup
   that passed the local drill. Keep the latest Family Link delivery receipts.
3. With the matching PocketBase binary, restore into a fresh
   `/var/lib/paydirt` owned by `paydirt`, retaining private file permissions.
   The admin UI (`/_/` → Settings → Backups) is another restore mechanism;
   the same worker precautions apply.
4. Start the backend and verify household records and balances. Reconcile
   queued/in-flight grants against the preserved receipts and Family Link
   before re-enabling the previously enabled workers. A snapshot can predate
   an external grant that already happened; replaying its queue can grant time
   twice. Never assume restoring SQLite revokes or rolls back Google time.

A real production recovery is not claimed by the disposable drill.

## Publishing app updates

`just publish-apk` and `just update-publish` write to local `pocketbase/pb_data/updates`. `just push-updates` mirrors that folder to `/var/lib/paydirt/updates` on the host (no restart needed).

## Going live with a real household

The host may still hold seeded test data. Two steps, each confirms before acting:

1. `just host-reset` — you type the host name to confirm; it snapshots `data.db` and `storage` to `backups/pre-reset-*.tgz`, wipes the DB, re-runs migrations and prints a **new superuser password** once. Family Link session, `updates/`, backups and the env file are kept.
2. `just go-live` — prompts for the household, parents, kids and optional starter chores by age band (`4-6`, `7-9`, `10-12`, `13+`), and prints generated logins once. Refuses to run if a household exists. `just go-live local` targets the Mac's PocketBase.

Afterwards: re-enter each kid's Family Link IDs in parent settings, and sign in again on every device (new accounts, new passwords).
