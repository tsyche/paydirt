# Deployment (always-on host)

**TL;DR:** PocketBase serves PayDirt's API and parent dashboard on bb:3111. Run `just install-service` once, then `just update-service`; data and saved browser auth survive updates. Family Link uses a separate queue worker, enabled explicitly after host/session setup.

## Layout on the host

| Path | Owner | Contents |
|---|---|---|
| `/opt/paydirt/` | root | `pocketbase` binary, `pb_hooks/`, `pb_migrations/`, `pb_public/` (dashboard) |
| `/var/lib/paydirt/` | `paydirt` (750) | `pb_data`: SQLite DBs, uploaded files, `updates/` (APK + OTA) |
| `/etc/paydirt/paydirt.env` | root (600, optional) | env overrides, e.g. `NTFY_SERVER=...` |
| `/etc/systemd/system/paydirt.service` | root | from [`pocketbase/paydirt.service`](../pocketbase/paydirt.service) |
| `/opt/paydirt/familylink/` | root | Family Link grant script, `playwright`, Playwright browsers (see [below](#family-link-grants)) |
| `/var/lib/paydirt/familylink/` | `paydirt` (700) | Google session (`familylink-state.json`, 600) |
| `/var/lib/paydirt/familylink/queue/` | `paydirt` (700) | Pending requests, claimed jobs, and durable result receipts (600) |
| `/etc/systemd/system/paydirt-fl.{path,service}` | root | Queue watcher and serialized grant worker, outside PocketBase's resource limits |

The unit runs as the unprivileged `paydirt` user with `ProtectSystem=strict`; only `/var/lib/paydirt` is writable. It listens on `0.0.0.0:3111` (LAN only — no public exposure).

## First install

1. `cp deploy.example.env deploy.local.env` and set `PAYDIRT_SSH_HOST` to the host's SSH alias (`bb`).
2. Stop local PocketBase (`just stop`) so its data copies cleanly.
3. `just install-service` from a terminal (remote `sudo` prompts). It:
   - creates the `paydirt` system user and the directories above;
   - imports local `pocketbase/pb_data` **only if** the host has no `data.db` yet;
   - then does everything `update-service` does.
4. Point the apps at the host:
   - Mobile: set `EXPO_PUBLIC_POCKETBASE_URL=http://<host-ip>:3111` in `apps/mobile/.env`, then `just push` (the URL is baked into the APK).
   - Dashboard: `http://<host-ip>:3111/` (admin UI at `/_/`).
5. Kids' VLAN (br1) needs a router LAN Access rule allowing `192.168.20.0/24` → `<host-ip>:3111`.

## Updates

`just update-service` builds the dashboard as a static export (`NEXT_PUBLIC_POCKETBASE_URL=/`, same origin), stages it with the hooks, migrations and unit in a private temp dir on the host, then:

- installs the PocketBase version matching local `pocketbase/pocketbase --version` (override with `PB_VERSION`), verified against the release's `checksums.txt`; skipped if already current;
- syncs `/opt/paydirt/`, reinstalls the unit, restarts, and polls `/api/health` on loopback.
- ships Family Link scripts/helpers and units without copying browser auth or installing browsers; once host setup exists, starts the queue watcher and runs worker recovery.

Migrations run automatically on restart. No commit or push is needed to deploy local changes.

## Operations

| Task | Command |
|---|---|
| Status | `just service-status` |
| Logs | `just service-logs [N]` |
| Restart | `just service-restart` |

## Family Link grants

Bonus screen time is granted through the Family Link web API ([`scripts/familylink-grant.mjs`](../scripts/familylink-grant.mjs)). Google rejects sign-in from automated browsers, so you sign in on the Mac and copy the session to the host.

Each grant reads the target device's active bonus and sets the bonus to remaining + purchased seconds. The calculation uses Google's server time and rounds remaining seconds up. Failed reads, missing devices, malformed responses, or unsupported active overrides stop the grant without writing. The worker and `fl-host-grant` share a host lock; do not run Mac grants concurrently with host grants.

1. Mac: `just fl-login` (sign in to the co-parent account by hand, then quit that Chrome). Needs `~/.config/paydirt/familylink.env` with `FL_CHILD_ID`, `FL_DEVICE_ID`, `FL_API_KEY`.
2. `just fl-host-setup [browsers]` (default `firefox`; `"firefox chromium"` for both). It is idempotent and:
   - installs Node 24 from the NodeSource apt repo (pinned over the distro's `nodejs`);
   - installs the script, `playwright` (the Mac's version) and Playwright's own browser builds under `/opt/paydirt/familylink/`. Stock `/usr/bin/firefox` can't be used, because Playwright drives only its patched builds;
   - copies the session to `/var/lib/paydirt/familylink/` and sets `FL_API_KEY` in `/etc/paydirt/paydirt.env`.
3. `just fl-host-grant <seconds> [firefox|chromium]` runs a test grant as `paydirt` through `systemd-run`, outside the PocketBase unit's memory/CPU limits. Exit 2 = session rejected or expired.

After a new `fl-login`, re-run `just fl-host-setup` to copy the session again. Code-only changes ship through `just update-service`.

### Enable automatic grants

Deploy the queue implementation with `just update-service` before enabling it. The additive CLI was validated on bb on 2026-10-28: a real grant preserved 59 seconds and added 60, setting 119 seconds. Queue deployment remains a separate step.

1. Set each child's Family Link child/device IDs in PayDirt's parent settings. Seeded accounts are test data; verify the real kid-to-tablet mapping first.
2. On bb, add `FL_AUTOMATION_ENABLED=1` to `/etc/paydirt/paydirt.env`. Leave the file root-owned, mode 600.
3. Restart `paydirt` on bb so the approval hook reads the flag. Each worker invocation reads the same environment file.
4. Approve one new screen-time purchase. Check the web/mobile parent Approvals view and `systemctl status paydirt-fl.path paydirt-fl.service`. The worker is a oneshot service, so inactive after a successful run is normal. The cron imports completed results once per minute.

When disabled or a child has no IDs, approval still deducts the purchase and shows a manual grant task. Existing approved purchases are never queued retroactively.

### Queue and failure handling

- Approval commits `grant_status=queued` with the spend. The hook publishes a private JSON request; the minute cron repairs a missed publish and imports results.
- `paydirt-fl.path` starts the worker. It claims each request atomically and processes grants serially, with a 60-second timeout per browser command.
- Receipts stay on disk to prevent replay. Failed or interrupted grants are never retried automatically: Google may have accepted a write before the connection failed.
- `grant_status` is `queued`, `granted`, `manual`, or `manual_done`; `grant_error` contains a safe recovery message. No browser responses, authenticated URLs, or credentials enter these fields or worker logs.
- For `manual`, check Family Link before adding time, then use **Mark granted manually** in either parent app. Session expiry instructs the parent to run `fl-login` and `fl-host-setup`; refreshing auth does not replay failed purchases.
- Updating code stops the worker. An interrupted job becomes manual review on recovery. Keep `queue/results/` receipts; do not remove the queue to retry grants.

To disable future automatic approvals, remove `FL_AUTOMATION_ENABLED` (or set it to `0`) and restart `paydirt`. A running browser grant can still finish. New worker runs turn remaining queued jobs into manual tasks. `FL_QUEUE_DIR` is a test override; production uses the fixed directory above.

Not yet automated: backups of `/var/lib/paydirt`, and pointing `just publish-apk` / `just update-publish` at the host (they still write local `pb_data/updates`). See [ROADMAP.md](../ROADMAP.md).
